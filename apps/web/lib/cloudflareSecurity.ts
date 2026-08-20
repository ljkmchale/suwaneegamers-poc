import "server-only";

import { isIP } from "node:net";
import { getDb } from "@/lib/db";

const API_BASE = "https://api.cloudflare.com/client/v4";
const AUTO_BLOCK_NOTE_PREFIX = "Suwanee Gamers automatic security block";

export type SecurityBlockStatus = "pending" | "active" | "failed" | "removed";
export type SecurityBlockSource = "automatic" | "manual";

export interface SecurityBlock {
  ip: string;
  cloudflareRuleId: string | null;
  status: SecurityBlockStatus;
  source: SecurityBlockSource;
  reason: string;
  createdAt: string;
  updatedAt: string;
  removedAt: string | null;
  lastError: string | null;
}

interface CloudflareEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code?: number; message?: string }>;
}

function config() {
  const token = process.env.CLOUDFLARE_SECURITY_API_TOKEN?.trim();
  const zoneId = process.env.CLOUDFLARE_SECURITY_ZONE_ID?.trim();
  if (!token || !zoneId) {
    throw new Error(
      "Cloudflare blocking is not configured. Set CLOUDFLARE_SECURITY_API_TOKEN and CLOUDFLARE_SECURITY_ZONE_ID.",
    );
  }
  return { token, zoneId };
}

export function cloudflareSecurityConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_SECURITY_API_TOKEN?.trim() &&
      process.env.CLOUDFLARE_SECURITY_ZONE_ID?.trim(),
  );
}

export function isPublicIp(ip: string | null | undefined): ip is string {
  if (!ip || isIP(ip) === 0) return false;
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "0.0.0.0") return false;
  if (normalized.startsWith("10.") || normalized.startsWith("127.") || normalized.startsWith("192.168.")) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) return false;
  if (normalized.startsWith("169.254.") || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return false;
  return true;
}

// Cloudflare uses this fixed address for cross-zone Worker subrequests. It is
// shared infrastructure, not the original visitor, so blocking it could affect
// unrelated Cloudflare traffic.
export function isBlockableSourceIp(ip: string | null | undefined): ip is string {
  return isPublicIp(ip) && ip.toLowerCase() !== "2a06:98c0:3600::103";
}

export function isVerifiedCloudflareRequest(headers: Headers): boolean {
  return Boolean(headers.get("cf-ray")?.trim() && headers.get("cf-connecting-ip")?.trim());
}

function errorMessage(body: CloudflareEnvelope<unknown>, status: number): string {
  const details = body.errors?.map((error) => error.message).filter(Boolean).join("; ");
  return details || `Cloudflare API returned HTTP ${status}`;
}

async function cloudflareRequest<T>(path: string, init: RequestInit): Promise<T> {
  const { token } = config();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(8_000),
  });
  const body = (await response.json()) as CloudflareEnvelope<T>;
  if (!response.ok || !body.success) throw new Error(errorMessage(body, response.status));
  return body.result;
}

function toSecurityBlock(row: {
  ip: string;
  cloudflare_rule_id: string | null;
  status: SecurityBlockStatus;
  source: SecurityBlockSource;
  reason: string;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
  last_error: string | null;
}): SecurityBlock {
  return {
    ip: row.ip,
    cloudflareRuleId: row.cloudflare_rule_id,
    status: row.status,
    source: row.source,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    removedAt: row.removed_at,
    lastError: row.last_error,
  };
}

export function getSecurityBlocks(): SecurityBlock[] {
  return (getDb()
    .prepare(`SELECT * FROM security_blocks ORDER BY status = 'active' DESC, updated_at DESC`)
    .all() as Parameters<typeof toSecurityBlock>[0][]).map(toSecurityBlock);
}

export function getSecurityBlock(ip: string): SecurityBlock | null {
  const row = getDb().prepare(`SELECT * FROM security_blocks WHERE ip = ?`).get(ip) as
    | Parameters<typeof toSecurityBlock>[0]
    | undefined;
  return row ? toSecurityBlock(row) : null;
}

function saveFailure(ip: string, source: SecurityBlockSource, reason: string, error: unknown) {
  const now = new Date().toISOString();
  const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown Cloudflare error";
  getDb().prepare(`
    INSERT INTO security_blocks
      (ip, cloudflare_rule_id, status, source, reason, created_at, updated_at, removed_at, last_error)
    VALUES (?, NULL, 'failed', ?, ?, ?, ?, NULL, ?)
    ON CONFLICT(ip) DO UPDATE SET
      status = 'failed', source = excluded.source, reason = excluded.reason,
      updated_at = excluded.updated_at, removed_at = NULL, last_error = excluded.last_error
  `).run(ip, source, reason, now, now, message);
}

export async function blockIp(
  ip: string,
  options: { source: SecurityBlockSource; reason: string },
): Promise<SecurityBlock> {
  if (!isBlockableSourceIp(ip)) {
    throw new Error("Only a valid, non-shared public IPv4 or IPv6 source can be blocked.");
  }
  const existing = getSecurityBlock(ip);
  const stalePendingCutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  if (
    existing?.status === "active" ||
    (existing?.status === "pending" && existing.updatedAt >= stalePendingCutoff)
  ) return existing;

  const { zoneId } = config();
  const claimedAt = new Date().toISOString();
  const claim = getDb().prepare(`
    INSERT INTO security_blocks
      (ip, cloudflare_rule_id, status, source, reason, created_at, updated_at, removed_at, last_error)
    VALUES (?, NULL, 'pending', ?, ?, ?, ?, NULL, NULL)
    ON CONFLICT(ip) DO UPDATE SET
      cloudflare_rule_id = NULL, status = 'pending', source = excluded.source,
      reason = excluded.reason, updated_at = excluded.updated_at, removed_at = NULL, last_error = NULL
    WHERE security_blocks.status IN ('failed', 'removed')
       OR (security_blocks.status = 'pending' AND security_blocks.updated_at < ?)
  `).run(ip, options.source, options.reason, claimedAt, claimedAt, stalePendingCutoff);
  // Another request already owns creation of the same provider rule.
  if (claim.changes === 0) return getSecurityBlock(ip)!;
  try {
    const rule = await cloudflareRequest<{ id: string }>(
      `/zones/${encodeURIComponent(zoneId)}/firewall/access_rules/rules`,
      {
        method: "POST",
        body: JSON.stringify({
          mode: "block",
          configuration: { target: isIP(ip) === 6 ? "ip6" : "ip", value: ip },
          notes: `${AUTO_BLOCK_NOTE_PREFIX}: ${options.reason}`.slice(0, 300),
        }),
      },
    );
    const now = new Date().toISOString();
    getDb().prepare(`
      INSERT INTO security_blocks
        (ip, cloudflare_rule_id, status, source, reason, created_at, updated_at, removed_at, last_error)
      VALUES (?, ?, 'active', ?, ?, ?, ?, NULL, NULL)
      ON CONFLICT(ip) DO UPDATE SET
        cloudflare_rule_id = excluded.cloudflare_rule_id, status = 'active',
        source = excluded.source, reason = excluded.reason, updated_at = excluded.updated_at,
        removed_at = NULL, last_error = NULL
    `).run(ip, rule.id, options.source, options.reason, now, now);
    return getSecurityBlock(ip)!;
  } catch (error) {
    saveFailure(ip, options.source, options.reason, error);
    throw error;
  }
}

export async function unblockIp(ip: string): Promise<SecurityBlock> {
  const existing = getSecurityBlock(ip);
  if (!existing || existing.status !== "active" || !existing.cloudflareRuleId) {
    throw new Error("This IP does not have an active Suwanee Gamers Cloudflare block.");
  }
  const { zoneId } = config();
  try {
    await cloudflareRequest<{ id: string }>(
      `/zones/${encodeURIComponent(zoneId)}/firewall/access_rules/rules/${encodeURIComponent(existing.cloudflareRuleId)}`,
      { method: "DELETE" },
    );
    const now = new Date().toISOString();
    getDb().prepare(`
      UPDATE security_blocks
      SET status = 'removed', updated_at = ?, removed_at = ?, last_error = NULL
      WHERE ip = ?
    `).run(now, now, ip);
    return getSecurityBlock(ip)!;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown Cloudflare error";
    getDb().prepare(`UPDATE security_blocks SET updated_at = ?, last_error = ? WHERE ip = ?`)
      .run(new Date().toISOString(), message, ip);
    throw error;
  }
}
