import "server-only";

import { getDb } from "@/lib/db";

export const SECURITY_EVENT_KINDS = ["failed_login", "admin_request", "suspicious_request"] as const;

export type SecurityEventKind = (typeof SECURITY_EVENT_KINDS)[number];

export interface SecurityEvent {
  id: number;
  createdAt: string;
  kind: SecurityEventKind;
  ip: string | null;
  method: string | null;
  path: string;
  userAgent: string | null;
}

const RETENTION_DAYS = 90;

// Common vulnerability-scanner probes: PHP/WordPress endpoints, dotfiles,
// config/backup files, database consoles, shell upload paths.
const SUSPICIOUS_PATH_RE =
  /\.(php|asp|aspx|jsp|cgi|env|sql|bak|ini|yml|yaml|pem|key)$|^\/(wp-|wordpress|phpmyadmin|pma|mysql|xmlrpc|cgi-bin|vendor\/|\.git|\.svn|\.aws|\.ssh|\.env|admin\.php|shell|config\.)|\/\.(git|env|aws|ssh)(\/|$)/i;

export function isSuspiciousPath(pathname: string): boolean {
  return SUSPICIOUS_PATH_RE.test(pathname);
}

/**
 * Best-effort client IP. Behind Cloudflare the real client IP arrives in
 * cf-connecting-ip; x-forwarded-for covers other proxies; direct hits have neither.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip");
}

export function recordSecurityEvent(input: {
  kind: SecurityEventKind;
  path: string;
  ip?: string | null;
  method?: string | null;
  userAgent?: string | null;
}): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO security_events (created_at, kind, ip, method, path, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      new Date().toISOString(),
      input.kind,
      input.ip ?? null,
      input.method ?? null,
      input.path.slice(0, 500),
      input.userAgent?.slice(0, 300) ?? null,
    );
    pruneOldEvents(db);
  } catch (error) {
    // Logging must never break request handling.
    console.error("[securityLog] failed to record event", error);
  }
}

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

/**
 * An IP is locked out of the admin login once it has LOCKOUT_THRESHOLD failed
 * attempts inside the window. Each further failed attempt is still recorded,
 * which keeps the window sliding while a bot hammers the form.
 */
export function isLoginLockedOut(ip: string | null): boolean {
  if (!ip) return false;
  try {
    const cutoff = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM security_events
         WHERE kind = 'failed_login' AND ip = ? AND created_at >= ?`,
      )
      .get(ip, cutoff) as { n: number };
    return row.n >= LOCKOUT_THRESHOLD;
  } catch (error) {
    // A logging-table problem must not lock the admin out.
    console.error("[securityLog] lockout check failed", error);
    return false;
  }
}

let lastPruneAt = 0;

function pruneOldEvents(db: ReturnType<typeof getDb>): void {
  const now = Date.now();
  if (now - lastPruneAt < 24 * 60 * 60 * 1000) return;
  lastPruneAt = now;
  const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`DELETE FROM security_events WHERE created_at < ?`).run(cutoff);
}

interface SecurityEventRow {
  id: number;
  created_at: string;
  kind: SecurityEventKind;
  ip: string | null;
  method: string | null;
  path: string;
  user_agent: string | null;
}

export function getRecentSecurityEvents(options?: {
  days?: number;
  kind?: SecurityEventKind;
  limit?: number;
}): SecurityEvent[] {
  const days = options?.days ?? 7;
  const limit = options?.limit ?? 500;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const db = getDb();
  const rows = (
    options?.kind
      ? db
          .prepare(
            `SELECT * FROM security_events WHERE created_at >= ? AND kind = ?
             ORDER BY created_at DESC LIMIT ?`,
          )
          .all(cutoff, options.kind, limit)
      : db
          .prepare(
            `SELECT * FROM security_events WHERE created_at >= ?
             ORDER BY created_at DESC LIMIT ?`,
          )
          .all(cutoff, limit)
  ) as SecurityEventRow[];

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    kind: row.kind,
    ip: row.ip,
    method: row.method,
    path: row.path,
    userAgent: row.user_agent,
  }));
}

export interface SecuritySummary {
  days: number;
  failedLogins: number;
  suspiciousRequests: number;
  adminRequests: number;
  topOffenderIps: Array<{ ip: string; events: number; lastSeenAt: string }>;
}

export function getSecuritySummary(days: number): SecuritySummary {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const db = getDb();

  const counts = db
    .prepare(
      `SELECT kind, COUNT(*) AS n FROM security_events WHERE created_at >= ? GROUP BY kind`,
    )
    .all(cutoff) as Array<{ kind: SecurityEventKind; n: number }>;
  const byKind = new Map(counts.map((c) => [c.kind, c.n]));

  const topOffenderIps = (
    db
      .prepare(
        `SELECT ip, COUNT(*) AS events, MAX(created_at) AS last_seen_at
         FROM security_events
         WHERE created_at >= ? AND ip IS NOT NULL AND kind != 'admin_request'
         GROUP BY ip ORDER BY events DESC LIMIT 10`,
      )
      .all(cutoff) as Array<{ ip: string; events: number; last_seen_at: string }>
  ).map((row) => ({ ip: row.ip, events: row.events, lastSeenAt: row.last_seen_at }));

  return {
    days,
    failedLogins: byKind.get("failed_login") ?? 0,
    suspiciousRequests: byKind.get("suspicious_request") ?? 0,
    adminRequests: byKind.get("admin_request") ?? 0,
    topOffenderIps,
  };
}
