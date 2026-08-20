import "server-only";

import { getDb } from "@/lib/db";
import { pruneExpired } from "@/lib/retention";
import {
  classifySecurityActors,
  overallThreatLevel,
  type ThreatActor,
  type ThreatLevel,
} from "@/lib/securityClassifier";
import { blockIp, cloudflareSecurityConfigured, isBlockableSourceIp } from "@/lib/cloudflareSecurity";

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
  /\.(php|asp|aspx|jsp|cgi|env|sql|bak|ini|yml|yaml|pem|key)$|^\/(wp-|wordpress|phpmyadmin|pma|mysql|xmlrpc|cgi-bin|vendor\/|\.git|\.svn|\.aws|\.ssh|\.env|admin\.php|shell|config\.|install(?:\/|$)|setup(?:\/|$))|\/\.(git|env|aws|ssh)(\/|$)/i;

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
    pruneExpired([{ table: "security_events", column: "created_at", days: RETENTION_DAYS }]);
  } catch (error) {
    // Logging must never break request handling.
    console.error("[securityLog] failed to record event", error);
  }
}

export interface AutomaticBlockDecision {
  shouldBlock: boolean;
  reason: string | null;
}

const CREDENTIAL_THEFT_PATH_RE =
  /(^|\/)(\.env(?:\.|\/|$)|credentials(?:\.|\/|$)|secrets?\.(?:ya?ml|json|env)|id_rsa(?:\.|$)|\.aws(?:\/|$)|\.ssh(?:\/|$)|[^/]+\.(?:pem|key)$)/i;
const INSTALL_OR_SHELL_PATH_RE =
  /(^|\/)(?:wp-admin\/)?(?:setup-config|install|setup)(?:\.php|\/|$)|(^|\/)(?:web)?shell(?:\.|\/|$)|(^|\/)(?:cmd|upload)\.php$|\/vendor\/phpunit(?:\/|$)/i;

export function immediateBlockReason(path: string, method?: string | null): string | null {
  if (CREDENTIAL_THEFT_PATH_RE.test(path)) return `credential or secret-file probe: ${path}`;
  if (INSTALL_OR_SHELL_PATH_RE.test(path)) return `installer or web-shell probe: ${path}`;
  if (method && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase()) && isSuspiciousPath(path)) {
    return `${method.toUpperCase()} write attempt against suspicious path: ${path}`;
  }
  return null;
}

export function automaticBlockDecision(
  events: Array<{ createdAt: string; kind: SecurityEventKind; path: string; method?: string | null }>,
  now = Date.now(),
): AutomaticBlockDecision {
  const immediate = events.find(
    (event) => event.kind === "suspicious_request" && immediateBlockReason(event.path, event.method),
  );
  if (immediate) {
    return { shouldBlock: true, reason: immediateBlockReason(immediate.path, immediate.method) };
  }
  const cutoff15m = now - 15 * 60_000;
  const cutoff60m = now - 60 * 60_000;
  const recent15 = events.filter((event) => new Date(event.createdAt).getTime() >= cutoff15m);
  const recent60Scans = events.filter(
    (event) => event.kind === "suspicious_request" && new Date(event.createdAt).getTime() >= cutoff60m,
  );
  const failed15 = recent15.filter((event) => event.kind === "failed_login").length;
  const scans15 = recent15.filter((event) => event.kind === "suspicious_request").length;
  const uniqueScannerPaths60 = new Set(recent60Scans.map((event) => event.path.toLowerCase())).size;
  if (failed15 >= 5) return { shouldBlock: true, reason: `${failed15} failed admin logins in 15 minutes` };
  if (scans15 >= 30) return { shouldBlock: true, reason: `${scans15} scanner probes in 15 minutes` };
  if (uniqueScannerPaths60 >= 15) {
    return { shouldBlock: true, reason: `${uniqueScannerPaths60} distinct vulnerability paths in 60 minutes` };
  }
  return { shouldBlock: false, reason: null };
}

export async function automaticallyBlockThreat(ip: string | null): Promise<void> {
  if (!isBlockableSourceIp(ip) || !cloudflareSecurityConfigured()) return;
  const cutoff = new Date(Date.now() - 60 * 60_000).toISOString();
  const events = getDb().prepare(`
    SELECT created_at, kind, path, method FROM security_events
    WHERE ip = ? AND created_at >= ? AND kind IN ('failed_login', 'suspicious_request')
    ORDER BY created_at DESC LIMIT 500
  `).all(ip, cutoff) as Array<{ created_at: string; kind: SecurityEventKind; path: string; method: string | null }>;
  const decision = automaticBlockDecision(
    events.map((event) => ({
      createdAt: event.created_at,
      kind: event.kind,
      path: event.path,
      method: event.method,
    })),
  );
  if (!decision.shouldBlock || !decision.reason) return;
  try {
    await blockIp(ip, { source: "automatic", reason: decision.reason });
  } catch (error) {
    // Enforcement failure is recorded for the admin page, but must never make
    // an attacker request capable of breaking the site for normal visitors.
    console.error("[securityLog] automatic Cloudflare block failed", error);
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

export interface SecuritySituation {
  level: ThreatLevel;
  actors: ThreatActor[];
  activeVisitors: number;
  signedInVisitors: number;
  anonymousVisitors: number;
  pageViews24h: number;
  securityEvents60m: number;
  scannerEvents60m: number;
  failedLogins60m: number;
  lastSecurityEventAt: string | null;
}

export function getSecuritySituation(): SecuritySituation {
  const db = getDb();
  const now = Date.now();
  const cutoff7d = new Date(now - 7 * 86_400_000).toISOString();
  const cutoff60m = new Date(now - 60 * 60_000).toISOString();
  const cutoff15m = new Date(now - 15 * 60_000).toISOString();
  const cutoff24h = new Date(now - 86_400_000).toISOString();
  const rows = db
    .prepare(`SELECT * FROM security_events WHERE created_at >= ? ORDER BY created_at DESC LIMIT 2000`)
    .all(cutoff7d) as SecurityEventRow[];
  const events = rows.map((row) => ({
    createdAt: row.created_at,
    kind: row.kind,
    ip: row.ip,
    path: row.path,
    userAgent: row.user_agent,
  }));
  const actors = classifySecurityActors(events, now);
  const currentActors = classifySecurityActors(
    events.filter((event) => event.createdAt >= cutoff60m),
    now,
  );
  const visitor = db.prepare(`
    SELECT COUNT(*) AS active,
      SUM(CASE WHEN visitor_email IS NOT NULL THEN 1 ELSE 0 END) AS signed_in
    FROM analytics_sessions WHERE last_seen_at >= ?
  `).get(cutoff15m) as { active: number; signed_in: number | null };
  const pageViews = db.prepare(`
    SELECT COUNT(*) AS n FROM analytics_events
    WHERE event_type = 'page_view' AND created_at >= ?
  `).get(cutoff24h) as { n: number };
  const current = events.filter((event) => event.createdAt >= cutoff60m);

  return {
    level: overallThreatLevel(currentActors),
    actors,
    activeVisitors: visitor.active,
    signedInVisitors: visitor.signed_in ?? 0,
    anonymousVisitors: visitor.active - (visitor.signed_in ?? 0),
    pageViews24h: pageViews.n,
    securityEvents60m: current.length,
    scannerEvents60m: current.filter((event) => event.kind === "suspicious_request").length,
    failedLogins60m: current.filter((event) => event.kind === "failed_login").length,
    lastSecurityEventAt: events[0]?.createdAt ?? null,
  };
}
