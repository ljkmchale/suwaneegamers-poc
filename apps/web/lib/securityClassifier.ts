export type ThreatLevel = "normal" | "system" | "scanner" | "suspicious" | "attack";

export interface ClassifiableSecurityEvent {
  createdAt: string;
  kind: "failed_login" | "admin_request" | "suspicious_request";
  ip: string | null;
  path: string;
  userAgent: string | null;
}

export interface ThreatActor {
  ip: string;
  level: ThreatLevel;
  label: string;
  explanation: string;
  events: number;
  scannerProbes: number;
  failedLogins: number;
  adminRequests: number;
  uniquePaths: number;
  lastSeenAt: string;
  evidence: string[];
}

const LEVEL_RANK: Record<ThreatLevel, number> = {
  normal: 0,
  system: 0,
  scanner: 1,
  suspicious: 2,
  attack: 3,
};

function isLocalAddress(ip: string) {
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

function browserLike(userAgent: string | null) {
  return /Mozilla\/5\.0/i.test(userAgent ?? "");
}

function eventsSince(events: ClassifiableSecurityEvent[], now: number, minutes: number) {
  const cutoff = now - minutes * 60_000;
  return events.filter((event) => new Date(event.createdAt).getTime() >= cutoff);
}

export function classifySecurityActors(
  events: ClassifiableSecurityEvent[],
  now = Date.now(),
): ThreatActor[] {
  const grouped = new Map<string, ClassifiableSecurityEvent[]>();
  for (const event of events) {
    const ip = event.ip ?? "Unknown IP";
    grouped.set(ip, [...(grouped.get(ip) ?? []), event]);
  }

  return [...grouped.entries()]
    .map(([ip, actorEvents]): ThreatActor => {
      const sorted = [...actorEvents].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const scannerProbes = actorEvents.filter((event) => event.kind === "suspicious_request").length;
      const failedLogins = actorEvents.filter((event) => event.kind === "failed_login").length;
      const adminRequests = actorEvents.filter((event) => event.kind === "admin_request").length;
      const uniquePaths = new Set(actorEvents.map((event) => event.path.toLowerCase())).size;
      const recent15 = eventsSince(actorEvents, now, 15);
      const recent60 = eventsSince(actorEvents, now, 60);
      const failed15 = recent15.filter((event) => event.kind === "failed_login").length;
      const scans15 = recent15.filter((event) => event.kind === "suspicious_request").length;
      const uniquePaths60 = new Set(recent60.map((event) => event.path.toLowerCase())).size;
      const latest = sorted[0];
      const evidence: string[] = [];

      let level: ThreatLevel;
      let label: string;
      let explanation: string;

      if (isLocalAddress(ip)) {
        level = "system";
        label = "Local/system check";
        explanation = "Traffic originated on this server or the private network, not from the public internet.";
        evidence.push("Local or private IP address");
      } else if (failed15 >= 5 || scans15 >= 30 || uniquePaths60 >= 15) {
        level = "attack";
        label = "Likely active attack";
        explanation = "This source crossed a high-confidence burst or login-attack threshold.";
        if (failed15 >= 5) evidence.push(`${failed15} failed logins in 15 minutes`);
        if (scans15 >= 30) evidence.push(`${scans15} scanner probes in 15 minutes`);
        if (uniquePaths60 >= 15) evidence.push(`${uniquePaths60} different targets in one hour`);
      } else if (failedLogins >= 3 || adminRequests >= 5 || scannerProbes >= 10) {
        level = "suspicious";
        label = "Needs attention";
        explanation = "Repeated security-sensitive activity warrants review, but does not prove a compromise.";
        if (failedLogins) evidence.push(`${failedLogins} failed login attempts`);
        if (adminRequests) evidence.push(`${adminRequests} protected admin requests`);
        if (scannerProbes) evidence.push(`${scannerProbes} scanner probes`);
      } else if (scannerProbes > 0) {
        level = "scanner";
        label = "Background scanner";
        explanation = "An automated internet scanner tested common software paths; this is hostile noise, not evidence it got in.";
        evidence.push(`${scannerProbes} known vulnerability path${scannerProbes === 1 ? "" : "s"}`);
      } else {
        level = "normal";
        label = browserLike(latest?.userAgent) ? "Likely normal person" : "Low-risk request";
        explanation =
          failedLogins === 1
            ? "A browser made one unsuccessful login attempt, which is consistent with a normal mistake."
            : "No scanner paths, login burst, or repeated protected-route probing was detected.";
        evidence.push(browserLike(latest?.userAgent) ? "Normal browser user agent" : "No attack pattern");
      }

      return {
        ip,
        level,
        label,
        explanation,
        events: actorEvents.length,
        scannerProbes,
        failedLogins,
        adminRequests,
        uniquePaths,
        lastSeenAt: latest?.createdAt ?? new Date(0).toISOString(),
        evidence,
      };
    })
    .sort(
      (a, b) =>
        LEVEL_RANK[b.level] - LEVEL_RANK[a.level] ||
        new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
    );
}

export function overallThreatLevel(actors: ThreatActor[]): ThreatLevel {
  return actors.reduce<ThreatLevel>(
    (highest, actor) => (LEVEL_RANK[actor.level] > LEVEL_RANK[highest] ? actor.level : highest),
    "normal",
  );
}
