import { randomUUID } from "node:crypto";
import { statfsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { contentDir } from "@/lib/contentFiles";
import { getDb } from "@/lib/db";
import { getWebsiteUpdates, type WebsiteUpdateSnapshot } from "@/lib/websiteUpdates";
import { dispatchHealthAlerts, type IncidentTransition } from "@/lib/healthNotifier";

export type HealthState = "healthy" | "degraded" | "unavailable" | "unknown";
export type DiagnosticDepth = "quick" | "full" | "component";

export interface DiagnosticResult {
  service: string;
  displayName: string;
  status: HealthState;
  message: string;
  technicalDetails?: string;
  checkedAt: string;
  responseTimeMs?: number;
  lastSuccessfulAt?: string;
  errorCode?: string;
  userImpact?: string;
  recommendedAction?: string;
}

export interface IncidentRecord {
  id: string;
  service: string;
  startedAt: string;
  resolvedAt?: string;
  status: "active" | "resolved";
  severity: "info" | "warning" | "critical";
  summary: string;
  technicalDetails?: string;
  userImpact?: string;
  resolution?: string;
  occurrenceCount?: number;
}

export interface MyraHealthStatus {
  overallStatus: HealthState;
  summary: string;
  checkedAt: string;
  cacheAgeMs: number;
  uptime: number;
  version: string;
  environment: string;
  capabilities: Record<string, boolean>;
  diagnostics: DiagnosticResult[];
  activeIncidents: IncidentRecord[];
  incidentHistory: IncidentRecord[];
  websiteUpdates: WebsiteUpdateSnapshot;
}

export interface HealthCheck {
  id: string;
  name: string;
  group: "ai" | "memory" | "voice" | "website" | "external" | "runtime";
  critical: boolean;
  timeoutMs: number;
  depths?: DiagnosticDepth[];
  run: () => Promise<DiagnosticResult>;
}

const startedAt = Date.now();
const cache = new Map<string, { value: MyraHealthStatus; savedAt: number }>();
const lastSuccess = new Map<string, string>();
const QUICK_TTL_MS = Number(process.env.MYRA_HEALTH_QUICK_INTERVAL_MS ?? 60_000);
const FULL_TTL_MS = Number(process.env.MYRA_HEALTH_FULL_INTERVAL_MS ?? 300_000);

function sanitized(value: unknown): string {
  return String(value ?? "Unknown error")
    .replace(/(?:sk|jina|Bearer)[-_A-Za-z0-9.]{8,}/gi, "[credential redacted]")
    .replace(/(?:token|key|secret|password)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .replace(/https?:\/\/[^\s/]+(?:\/[^\s]*)?/gi, "[internal endpoint]")
    .slice(0, 500);
}

async function fetchCheck(id: string, name: string, url: string, okay: (r: Response) => boolean = (r) => r.ok): Promise<DiagnosticResult> {
  const began = performance.now();
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_500), cache: "no-store" });
    const responseTimeMs = Math.round(performance.now() - began);
    if (!okay(response)) {
      const status = response.status === 401 || response.status === 403 || response.status === 429 ? "degraded" : "unavailable";
      return { service: id, displayName: name, status, message: `${name} returned an error.`, technicalDetails: `HTTP ${response.status}`, errorCode: `HTTP_${response.status}`, checkedAt, responseTimeMs };
    }
    lastSuccess.set(id, checkedAt);
    return { service: id, displayName: name, status: "healthy", message: `${name} is responding normally.`, checkedAt, responseTimeMs, lastSuccessfulAt: checkedAt };
  } catch (error) {
    return { service: id, displayName: name, status: "unavailable", message: `${name} is not responding.`, technicalDetails: sanitized(error), errorCode: error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "CONNECTION_FAILED", checkedAt, responseTimeMs: Math.round(performance.now() - began), lastSuccessfulAt: lastSuccess.get(id) };
  }
}

async function cloudflareWebsiteCheck(): Promise<DiagnosticResult> {
  const id = "cloudflare";
  const name = "Public website through Cloudflare";
  const url = process.env.MYRA_CLOUDFLARE_HEALTH_URL ?? "https://www.suwaneegamers.net/signin";
  const began = performance.now();
  const checkedAt = new Date().toISOString();
  try {
    const probeUrl = new URL(url);
    probeUrl.searchParams.set("myra-health", String(Date.now()));
    const response = await fetch(probeUrl, {
      signal: AbortSignal.timeout(7_500),
      cache: "no-store",
      redirect: "follow",
      headers: { "cache-control": "no-cache" },
    });
    const responseTimeMs = Math.round(performance.now() - began);
    if (!response.ok) {
      return { service: id, displayName: name, status: "unavailable", message: "The public Suwanee Gamers website is not reachable through Cloudflare.", technicalDetails: `HTTP ${response.status}`, errorCode: `HTTP_${response.status}`, checkedAt, responseTimeMs, lastSuccessfulAt: lastSuccess.get(id), userImpact: "Visitors may be unable to reach the public website." };
    }
    const server = response.headers.get("server") ?? "";
    const cfRay = response.headers.get("cf-ray") ?? "";
    if (!cfRay && !server.toLowerCase().includes("cloudflare")) {
      return { service: id, displayName: name, status: "degraded", message: "The public website responded, but its Cloudflare route could not be verified.", technicalDetails: "The response did not include a Cloudflare server or cf-ray header.", errorCode: "CLOUDFLARE_HEADERS_MISSING", checkedAt, responseTimeMs, lastSuccessfulAt: lastSuccess.get(id), userImpact: "The public site is responding, but Cloudflare protection and tunnel routing are uncertain." };
    }
    lastSuccess.set(id, checkedAt);
    return { service: id, displayName: name, status: "healthy", message: "The public website is active and responding through Cloudflare.", technicalDetails: `HTTP ${response.status}; Cloudflare ray ${cfRay || "present via server header"}`, checkedAt, responseTimeMs, lastSuccessfulAt: checkedAt };
  } catch (error) {
    return { service: id, displayName: name, status: "unavailable", message: "The public Suwanee Gamers website is not reachable through Cloudflare.", technicalDetails: sanitized(error), errorCode: error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "CONNECTION_FAILED", checkedAt, responseTimeMs: Math.round(performance.now() - began), lastSuccessfulAt: lastSuccess.get(id), userImpact: "Visitors may be unable to reach the public website." };
  }
}

async function tcpCheck(id: string, name: string, port: number): Promise<DiagnosticResult> {
  const began = performance.now();
  const checkedAt = new Date().toISOString();
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (status: HealthState, message: string, code?: string) => {
      socket.destroy();
      if (status === "healthy") lastSuccess.set(id, checkedAt);
      resolve({ service: id, displayName: name, status, message, checkedAt, responseTimeMs: Math.round(performance.now() - began), lastSuccessfulAt: lastSuccess.get(id), errorCode: code });
    };
    socket.setTimeout(2_500);
    socket.once("connect", () => done("healthy", `${name} is accepting connections.`));
    socket.once("timeout", () => done("unavailable", `${name} timed out.`, "TIMEOUT"));
    socket.once("error", () => done("unavailable", `${name} is not accepting connections.`, "CONNECTION_FAILED"));
  });
}

function localCheck(id: string, name: string, run: () => void): Promise<DiagnosticResult> {
  const began = performance.now();
  const checkedAt = new Date().toISOString();
  try {
    run();
    lastSuccess.set(id, checkedAt);
    return Promise.resolve({ service: id, displayName: name, status: "healthy", message: `${name} is available.`, checkedAt, responseTimeMs: Math.round(performance.now() - began), lastSuccessfulAt: checkedAt });
  } catch (error) {
    return Promise.resolve({ service: id, displayName: name, status: "unavailable", message: `${name} could not be accessed.`, technicalDetails: sanitized(error), errorCode: "LOCAL_ACCESS_FAILED", checkedAt, responseTimeMs: Math.round(performance.now() - began), lastSuccessfulAt: lastSuccess.get(id) });
  }
}

export const healthRegistry: HealthCheck[] = [
  { id: "database", name: "Suwanee Gamers database", group: "website", critical: true, timeoutMs: 2_000, run: () => localCheck("database", "Suwanee Gamers database", () => { getDb().prepare("SELECT 1 AS ok").get(); getDb().exec("CREATE TEMP TABLE IF NOT EXISTS myra_health_write_test(value TEXT); DELETE FROM myra_health_write_test; INSERT INTO myra_health_write_test VALUES ('ok')"); }) },
  { id: "memory", name: "Karpathy LLM Wiki and memory", group: "memory", critical: false, timeoutMs: 2_000, run: () => localCheck("memory", "Karpathy LLM Wiki and memory", () => { const db = getDb(); db.prepare("SELECT json FROM content_documents WHERE path = 'assistant-learned.json'").get(); const fs = statfsSync(path.join(process.cwd(), "brain-data")); if (!fs.blocks) throw new Error("Memory storage is unavailable"); }) },
  { id: "ollama", name: "Local fallback AI", group: "ai", critical: true, timeoutMs: 4_000, run: () => fetchCheck("ollama", "Local fallback AI", process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/api/tags") },
  { id: "speaches", name: "Speech recognition and voice", group: "voice", critical: false, timeoutMs: 4_000, run: () => fetchCheck("speaches", "Speech recognition and voice", `${process.env.SPEACHES_BASE_URL ?? "http://127.0.0.1:8000"}/v1/models`) },
  { id: "parakeet", name: "Parakeet primary speech recognition", group: "voice", critical: false, timeoutMs: 4_000, run: () => fetchCheck("parakeet", "Parakeet primary speech recognition", `${process.env.PARAKEET_BASE_URL ?? "http://127.0.0.1:8767"}/v1/models`) },
  { id: "livekit", name: "LiveKit realtime voice", group: "voice", critical: false, timeoutMs: 3_000, run: () => tcpCheck("livekit", "LiveKit realtime voice", Number(process.env.LIVEKIT_PORT ?? 7880)) },
  { id: "website", name: "Local Suwanee Gamers website service", group: "website", critical: true, timeoutMs: 5_000, run: () => fetchCheck("website", "Local Suwanee Gamers website service", `${process.env.MYRA_WEBSITE_HEALTH_URL ?? "http://127.0.0.1:4652/signin"}`) },
  { id: "cloudflare", name: "Public website through Cloudflare", group: "website", critical: true, timeoutMs: 9_000, run: cloudflareWebsiteCheck },
  { id: "search", name: "Chronicles search index", group: "memory", critical: false, timeoutMs: 2_000, depths: ["full", "component"], run: () => localCheck("search", "Chronicles search index", () => { const fs = statfsSync(path.join(process.cwd(), "brain-data")); if (!fs.bavail) throw new Error("Search storage unavailable"); }) },
  { id: "anthropic", name: "Primary Claude provider", group: "external", critical: false, timeoutMs: 2_000, depths: ["full", "component"], run: async () => ({ service: "anthropic", displayName: "Primary Claude provider", status: process.env.ANTHROPIC_API_KEY ? "healthy" : "unknown", message: process.env.ANTHROPIC_API_KEY ? "Claude credentials are configured; live use is tracked by the voice worker." : "Claude credentials are not configured in the web process.", checkedAt: new Date().toISOString(), errorCode: process.env.ANTHROPIC_API_KEY ? undefined : "NOT_CONFIGURED" }) },
  { id: "runtime", name: "Myra runtime", group: "runtime", critical: false, timeoutMs: 1_000, depths: ["full", "component"], run: async () => { const usage = process.memoryUsage(); const disk = statfsSync(contentDir()); const free = disk.bavail * disk.bsize; const status: HealthState = free < 512 * 1024 * 1024 ? "degraded" : "healthy"; return { service: "runtime", displayName: "Myra runtime", status, message: status === "healthy" ? "Runtime resources are within normal limits." : "Disk space is running low.", technicalDetails: `RSS ${Math.round(usage.rss / 1024 / 1024)} MB; free disk ${Math.round(free / 1024 / 1024 / 1024)} GB`, checkedAt: new Date().toISOString(), userImpact: status === "degraded" ? "Logs and new saved content may eventually fail." : undefined }; } },
];

function simulation(check: HealthCheck): HealthState | undefined {
  if (process.env.NODE_ENV === "production" || process.env.MYRA_HEALTH_TEST_MODE !== "true") return undefined;
  const raw = process.env.MYRA_HEALTH_SIMULATE ?? "";
  const pair = raw.split(",").map((v) => v.trim().split(":"));
  return pair.find(([id]) => id === check.id)?.[1] as HealthState | undefined;
}

async function runOne(check: HealthCheck): Promise<DiagnosticResult> {
  const simulated = simulation(check);
  if (simulated) return { service: check.id, displayName: check.name, status: simulated, message: `Simulated ${simulated} state.`, checkedAt: new Date().toISOString(), errorCode: "SIMULATED", userImpact: simulated === "healthy" ? undefined : `${check.name} capabilities may be limited.` };
  try {
    return await Promise.race([check.run(), new Promise<DiagnosticResult>((resolve) => setTimeout(() => resolve({ service: check.id, displayName: check.name, status: "unavailable", message: `${check.name} timed out.`, checkedAt: new Date().toISOString(), errorCode: "TIMEOUT" }), check.timeoutMs))]);
  } catch (error) {
    return { service: check.id, displayName: check.name, status: "unknown", message: `${check.name} could not be checked.`, technicalDetails: sanitized(error), checkedAt: new Date().toISOString(), errorCode: "CHECK_FAILED" };
  }
}

function severityFor(check: HealthCheck, result: DiagnosticResult): IncidentRecord["severity"] {
  if (result.status === "unavailable" && check.critical) return "critical";
  if (result.status === "healthy") return "info";
  return "warning";
}

function reconcileIncidents(results: DiagnosticResult[]): IncidentTransition[] {
  const db = getDb();
  const active = db.prepare("SELECT id, service, severity, started_at AS startedAt FROM myra_health_incidents WHERE status = 'active'").all() as Array<{ id: string; service: string; severity: IncidentTransition["severity"]; startedAt: string }>;
  const activeByService = new Map(active.map((row) => [row.service, row]));
  const now = new Date().toISOString();
  const transitions: IncidentTransition[] = [];
  const insert = db.prepare(`INSERT INTO myra_health_incidents (id, service, started_at, status, severity, summary, technical_details, user_impact, last_seen_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`);
  const update = db.prepare(`UPDATE myra_health_incidents SET last_seen_at = ?, occurrence_count = occurrence_count + 1, severity = ?, summary = ?, technical_details = ?, user_impact = ? WHERE id = ?`);
  const resolve = db.prepare(`UPDATE myra_health_incidents SET status = 'resolved', resolved_at = ?, last_seen_at = ?, resolution = ? WHERE id = ?`);
  db.transaction(() => {
    for (const result of results) {
      const existing = activeByService.get(result.service);
      if (result.status === "healthy") {
        if (existing) {
          resolve.run(now, now, `${result.displayName} recovered automatically.`, existing.id);
          transitions.push({ kind: "resolved", service: result.service, displayName: result.displayName, severity: existing.severity, summary: `${result.displayName} recovered automatically.`, startedAt: existing.startedAt, resolvedAt: now });
        }
      } else if (result.status !== "unknown") {
        const check = healthRegistry.find((item) => item.id === result.service)!;
        const severity = severityFor(check, result);
        if (existing) update.run(now, severity, result.message, result.technicalDetails ?? null, result.userImpact ?? null, existing.id);
        else {
          insert.run(randomUUID(), result.service, now, severity, result.message, result.technicalDetails ?? null, result.userImpact ?? null, now);
          transitions.push({ kind: "opened", service: result.service, displayName: result.displayName, severity, summary: result.message, technicalDetails: result.technicalDetails, userImpact: result.userImpact, startedAt: now });
        }
      }
    }
  })();
  return transitions;
}

export function listHealthIncidents(limit = 100): IncidentRecord[] {
  return (getDb().prepare(`SELECT id, service, started_at AS startedAt, resolved_at AS resolvedAt, status, severity, summary, technical_details AS technicalDetails, user_impact AS userImpact, resolution, occurrence_count AS occurrenceCount FROM myra_health_incidents ORDER BY started_at DESC LIMIT ?`).all(limit) as IncidentRecord[]);
}

export function calculateOverall(results: DiagnosticResult[]): HealthState {
  if (!results.length || results.every((r) => r.status === "unknown")) return "unknown";
  if (results.some((r) => r.status === "unavailable" && healthRegistry.find((c) => c.id === r.service)?.critical)) return "unavailable";
  if (results.some((r) => r.status !== "healthy")) return "degraded";
  return "healthy";
}

export interface HealthNarrativeContext {
  uptimeSeconds?: number;
  incidents?: IncidentRecord[];
  now?: number;
}

// Spoken-friendly "2 days", "about 3 hours", "45 minutes". Largest unit only, so
// Myra never rattles off "2 days, 4 hours, 11 minutes, 6 seconds".
function humanizeDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const day = 86_400;
  const hour = 3_600;
  const minute = 60;
  if (s >= day) { const d = Math.round(s / day); return `${d} day${d === 1 ? "" : "s"}`; }
  if (s >= hour) { const h = Math.round(s / hour); return `${h} hour${h === 1 ? "" : "s"}`; }
  if (s >= minute) { const m = Math.round(s / minute); return `${m} minute${m === 1 ? "" : "s"}`; }
  return "less than a minute";
}

// A short spoken clause about critical incidents that resolved within the last
// day, so a healthy answer still reflects the monitor's overnight work instead of
// repeating one canned sentence.
function recentRecoveryNote(incidents: IncidentRecord[], now: number): string {
  const dayAgo = now - 86_400_000;
  const recovered = incidents.filter(
    (i) => i.status === "resolved" && i.severity === "critical" && i.resolvedAt && Date.parse(i.resolvedAt) >= dayAgo,
  );
  if (recovered.length === 0) return "";
  if (recovered.length === 1) {
    const name = friendlyServiceName(recovered[0].service);
    return ` Earlier today I had a brief issue with ${name}, but it recovered on its own.`;
  }
  return ` I had a couple of brief hiccups earlier today, but everything recovered on its own.`;
}

function friendlyServiceName(service: string): string {
  return healthRegistry.find((c) => c.id === service)?.name ?? service;
}

export function conversationalSummary(
  overall: HealthState,
  results: DiagnosticResult[],
  context: HealthNarrativeContext = {},
): string {
  const now = context.now ?? Date.now();
  const bad = results.filter((r) => r.status !== "healthy" && r.status !== "unknown");
  if (overall === "unknown") return "I'm able to respond, but my diagnostic service could not verify the condition of my internal systems.";
  if (overall === "healthy") {
    let line = "I'm feeling great. My AI, memory, voice, website, and connected services are all responding normally.";
    if (context.uptimeSeconds && context.uptimeSeconds >= 120) {
      line += ` I've been running smoothly for ${humanizeDuration(context.uptimeSeconds)}.`;
    }
    line += recentRecoveryNote(context.incidents ?? [], now);
    return line;
  }
  const impacts = bad.map((r) => r.userImpact ?? r.message).slice(0, 3).join(" ");
  // When did the trouble start? The oldest still-active incident anchors it.
  const active = (context.incidents ?? [])
    .filter((i) => i.status === "active")
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const since = active[0] ? ` This started about ${humanizeDuration((now - Date.parse(active[0].startedAt)) / 1000)} ago.` : "";
  return overall === "unavailable"
    ? `I'm having a major system problem. ${impacts}${since}`
    : `I'm mostly okay, but part of my system is degraded. ${impacts}${since}`;
}

export async function getMyraHealth(options: { depth?: DiagnosticDepth; service?: string; force?: boolean } = {}): Promise<MyraHealthStatus> {
  const depth = options.depth ?? "quick";
  const key = options.service ? `${depth}:${options.service}` : depth;
  const ttl = depth === "full" ? FULL_TTL_MS : QUICK_TTL_MS;
  const cached = cache.get(key);
  if (!options.force && cached && Date.now() - cached.savedAt < ttl) return { ...cached.value, cacheAgeMs: Date.now() - cached.savedAt };
  const checks = options.service ? healthRegistry.filter((check) => check.id === options.service || check.group === options.service) : healthRegistry.filter((check) => depth === "full" || !check.depths || check.depths.includes(depth));
  if (!checks.length) throw Object.assign(new Error("Unknown diagnostic service."), { code: "UNKNOWN_SERVICE" });
  const diagnostics = await Promise.all(checks.map(runOne));
  const transitions = reconcileIncidents(diagnostics);
  // Fire-and-forget: a newly-opened or recovered critical outage emails a human.
  // Never awaited, never allowed to fail the check that produced it.
  void dispatchHealthAlerts(transitions).catch((error) => console.error(JSON.stringify({ event: "myra_health_alert_dispatch_error", errorCode: error instanceof Error ? error.name : "UNKNOWN" })));
  const overallStatus = calculateOverall(diagnostics);
  const incidentHistory = listHealthIncidents();
  const websiteUpdates = getWebsiteUpdates();
  const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);
  const value: MyraHealthStatus = {
    overallStatus,
    summary: conversationalSummary(overallStatus, diagnostics, { uptimeSeconds, incidents: incidentHistory }),
    checkedAt: new Date().toISOString(),
    cacheAgeMs: 0,
    uptime: uptimeSeconds,
    version: process.env.SUWANEE_BUILD_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.npm_package_version ?? "development",
    environment: process.env.NODE_ENV ?? "development",
    capabilities: {
      conversation: diagnostics.find((r) => r.service === "ollama")?.status !== "unavailable",
      voice: !diagnostics.some((r) => ["parakeet", "speaches", "livekit"].includes(r.service) && r.status === "unavailable"),
      longTermMemory: diagnostics.find((r) => r.service === "memory")?.status !== "unavailable",
      websiteAccess: !diagnostics.some((r) => ["website", "cloudflare", "database"].includes(r.service) && r.status === "unavailable"),
      webSearch: diagnostics.find((r) => r.service === "search")?.status !== "unavailable",
    },
    diagnostics,
    activeIncidents: incidentHistory.filter((i) => i.status === "active"),
    incidentHistory,
    websiteUpdates,
  };
  cache.set(key, { value, savedAt: Date.now() });
  console.info(JSON.stringify({ event: "myra_health_check", correlationId: randomUUID(), checkedAt: value.checkedAt, overallStatus, services: diagnostics.map((r) => ({ service: r.service, status: r.status, responseTimeMs: r.responseTimeMs, errorCode: r.errorCode })) }));
  return value;
}

export function publicHealthSummary(value: MyraHealthStatus) {
  return { overallStatus: value.overallStatus, summary: value.summary, checkedAt: value.checkedAt, cacheAgeMs: value.cacheAgeMs, capabilities: value.capabilities, issues: value.diagnostics.filter((r) => r.status !== "healthy").map(({ service, status, message, userImpact, recommendedAction }) => ({ service, status, message, userImpact, recommendedAction })), websiteUpdates: value.websiteUpdates };
}
