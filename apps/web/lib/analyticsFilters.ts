import { createHash } from "node:crypto";

export type AnalyticsAudience = "all" | "external" | "members" | "unidentified" | "internal";

export function analyticsVisitorToken(visitorKey: string) {
  return createHash("sha256").update(visitorKey).digest("hex").slice(0, 20);
}

export function analyticsAudience(value?: string): AnalyticsAudience {
  return ["external", "members", "unidentified", "internal"].includes(value ?? "")
    ? value as AnalyticsAudience : "external";
}

export const AUDIENCE_LABELS: Record<AnalyticsAudience, string> = {
  all: "Everyone including internal", external: "Visitors (webmaster excluded)", members: "Members (excluding internal)",
  unidentified: "Unidentified visitors", internal: "Internal activity",
};

// Fixed predicates only: request text is never interpolated into SQL.
// These are the known owner/testing identities used by the existing dashboard.
const internal = `(LOWER(COALESCE(visitor_email, '')) = 'larry.m.mchale@gmail.com'
  OR visitor_id IN ('a016fca43f790a8dd13b89acc6f02f4f6ea0ff0d75306c4018368143dc83da83',
  '13439a50678cee3d6aa656d5ca9e73bb96d8c2271e104016adfb0a2dab22e457',
  '1b10c42d40ec5e73c5db1b5cd733669b010a2eb3c0bccb8a55cc70ed95bd0674',
  '5991d2b167bec013cb028f2b2ee1b2126d7c68ec248f71a16c917a234c82e9ed',
  '9e8b4eafc0e736bde5670250ce03978200d9230d47916715c4672022de8bec09')
  OR referrer_host IN ('localhost', '127.0.0.1'))`;

export function audienceSessions(audience: AnalyticsAudience = "all") {
  const predicate = audience === "internal" ? `COALESCE(${internal}, 0)`
    : audience === "external" ? `NOT COALESCE(${internal}, 0)`
    : audience === "members" ? `visitor_email IS NOT NULL AND NOT COALESCE(${internal}, 0)`
    : audience === "unidentified" ? `visitor_email IS NULL AND NOT COALESCE(${internal}, 0)` : "1 = 1";
  return `SELECT session_id FROM analytics_sessions WHERE ${predicate}`;
}

export function analyticsPeriod(days: number, now = new Date()) {
  const safeDays = [7, 30, 90].includes(days) ? days : 30;
  const since = new Date(now);
  since.setDate(since.getDate() - safeDays + 1);
  since.setHours(0, 0, 0, 0);
  return { days: safeDays, since, sinceIso: since.toISOString() };
}
