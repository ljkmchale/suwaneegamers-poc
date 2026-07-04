import "server-only";

import { createHash } from "crypto";
import { getDb } from "@/lib/db";

export const ANALYTICS_EVENT_TYPES = [
  "page_view",
  "page_engagement",
  "content_view",
  "content_open",
  "media_play",
  "media_complete",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export interface UsageEventInput {
  eventType: AnalyticsEventType;
  path: string;
  contentType?: string;
  contentId?: string;
  contentLabel?: string;
  durationSeconds?: number;
}

export interface AnalyticsDashboardData {
  days: number;
  summary: {
    pageViews: number;
    uniqueVisitors: number;
    engagedMinutes: number;
    mediaPlays: number;
    activeNow: number;
  };
  daily: Array<{
    date: string;
    pageViews: number;
    visitors: number;
    engagedSeconds: number;
    mediaPlays: number;
  }>;
  topPages: Array<{
    path: string;
    pageViews: number;
    visitors: number;
    engagedSeconds: number;
  }>;
  topContent: Array<{
    label: string;
    type: string;
    views: number;
  }>;
  topMedia: Array<{
    label: string;
    mediaId: string;
    plays: number;
    completions: number;
  }>;
  devices: Array<{ label: string; value: number }>;
  referrers: Array<{ label: string; value: number }>;
  recentVisitors: Array<{
    lastSeenAt: string;
    entryPath: string;
    lastPath: string;
    deviceType: string;
    pageViews: number;
    engagedSeconds: number;
  }>;
  syncJobs: Array<{
    id: string;
    label: string;
    status: string | null;
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    nextRunAt: string | null;
    durationMs: number | null;
  }>;
  recentSyncRuns: Array<{
    id: number;
    label: string;
    startedAt: string;
    status: string;
    durationMs: number | null;
    message: string | null;
  }>;
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  return cleaned || undefined;
}

export function cleanAnalyticsPath(value: unknown): string | undefined {
  const path = cleanText(value, 240);
  if (!path || !path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) {
    return undefined;
  }
  return path.split("?")[0].split("#")[0];
}

export function normalizeUsageEvent(value: unknown): UsageEventInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!ANALYTICS_EVENT_TYPES.includes(candidate.eventType as AnalyticsEventType)) return null;
  const path = cleanAnalyticsPath(candidate.path);
  if (!path) return null;
  return {
    eventType: candidate.eventType as AnalyticsEventType,
    path,
    contentType: cleanText(candidate.contentType, 40),
    contentId: cleanText(candidate.contentId, 300),
    contentLabel: cleanText(candidate.contentLabel, 160),
    durationSeconds: Math.min(3600, Math.max(0, Math.round(Number(candidate.durationSeconds) || 0))),
  };
}

export function anonymizeSessionId(rawId: string): string {
  const secret = process.env.ANALYTICS_HASH_SECRET
    ?? process.env.ADMIN_SESSION_SECRET
    ?? "suwanee-gamers-local-analytics";
  return createHash("sha256").update(`${secret}:${rawId}`).digest("hex");
}

function safeReferrerHost(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return hostname || null;
  } catch {
    return null;
  }
}

export function recordUsageEvents(input: {
  rawSessionId: string;
  events: UsageEventInput[];
  referrer?: string;
  userAgent?: string;
}): void {
  const db = getDb();
  const sessionId = anonymizeSessionId(input.rawSessionId);
  const now = new Date().toISOString();
  const ua = input.userAgent ?? "";
  const deviceType = /ipad|tablet/i.test(ua)
    ? "tablet"
    : /mobile|iphone|android/i.test(ua)
      ? "mobile"
      : "desktop";
  const referrerHost = safeReferrerHost(input.referrer);
  const entryPath = input.events[0]?.path ?? "/";

  const insertSession = db.prepare(`
    INSERT INTO analytics_sessions
      (session_id, first_seen_at, last_seen_at, entry_path, last_path, referrer_host, device_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO NOTHING
  `);
  const updateSession = db.prepare(`
    UPDATE analytics_sessions
    SET last_seen_at = ?,
        last_path = ?,
        page_views = page_views + ?,
        engaged_seconds = engaged_seconds + ?
    WHERE session_id = ?
  `);
  const insertEvent = db.prepare(`
    INSERT INTO analytics_events
      (session_id, event_type, path, content_type, content_id, content_label, duration_seconds, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertSession.run(sessionId, now, now, entryPath, entryPath, referrerHost, deviceType);
    for (const event of input.events) {
      insertEvent.run(
        sessionId,
        event.eventType,
        event.path,
        event.contentType ?? null,
        event.contentId ?? null,
        event.contentLabel ?? null,
        event.durationSeconds ?? 0,
        now,
      );
    }
    updateSession.run(
      now,
      input.events.at(-1)?.path ?? entryPath,
      input.events.filter((event) => event.eventType === "page_view").length,
      input.events
        .filter((event) => event.eventType === "page_engagement")
        .reduce((total, event) => total + (event.durationSeconds ?? 0), 0),
      sessionId,
    );
  })();
}

export function getAnalyticsDashboardData(days: number): AnalyticsDashboardData {
  const db = getDb();
  const safeDays = [7, 30, 90].includes(days) ? days : 30;
  const since = new Date(Date.now() - (safeDays - 1) * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const summary = db.prepare(`
    SELECT
      SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      COUNT(DISTINCT session_id) AS visitors,
      SUM(CASE WHEN event_type = 'page_engagement' THEN duration_seconds ELSE 0 END) AS engaged_seconds,
      SUM(CASE WHEN event_type = 'media_play' THEN 1 ELSE 0 END) AS media_plays
    FROM analytics_events
    WHERE created_at >= ?
  `).get(sinceIso) as {
    page_views: number | null;
    visitors: number | null;
    engaged_seconds: number | null;
    media_plays: number | null;
  };

  const activeNow = (db.prepare(`
    SELECT COUNT(*) AS count
    FROM analytics_sessions
    WHERE last_seen_at >= ?
  `).get(new Date(Date.now() - 5 * 60_000).toISOString()) as { count: number }).count;

  const dailyRows = db.prepare(`
    SELECT
      date(created_at, 'localtime') AS date,
      SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      COUNT(DISTINCT session_id) AS visitors,
      SUM(CASE WHEN event_type = 'page_engagement' THEN duration_seconds ELSE 0 END) AS engaged_seconds,
      SUM(CASE WHEN event_type = 'media_play' THEN 1 ELSE 0 END) AS media_plays
    FROM analytics_events
    WHERE created_at >= ?
    GROUP BY date(created_at, 'localtime')
    ORDER BY date
  `).all(sinceIso) as Array<{
    date: string;
    page_views: number;
    visitors: number;
    engaged_seconds: number;
    media_plays: number;
  }>;
  const dailyMap = new Map(dailyRows.map((row) => [row.date, row]));
  const daily = Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(since);
    date.setDate(date.getDate() + index);
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const row = dailyMap.get(key);
    return {
      date: key,
      pageViews: row?.page_views ?? 0,
      visitors: row?.visitors ?? 0,
      engagedSeconds: row?.engaged_seconds ?? 0,
      mediaPlays: row?.media_plays ?? 0,
    };
  });

  const topPages = (db.prepare(`
    SELECT
      path,
      SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      COUNT(DISTINCT session_id) AS visitors,
      SUM(CASE WHEN event_type = 'page_engagement' THEN duration_seconds ELSE 0 END) AS engaged_seconds
    FROM analytics_events
    WHERE created_at >= ?
    GROUP BY path
    HAVING page_views > 0
    ORDER BY page_views DESC, engaged_seconds DESC
    LIMIT 12
  `).all(sinceIso) as Array<{
    path: string;
    page_views: number;
    visitors: number;
    engaged_seconds: number;
  }>).map((row) => ({
    path: row.path,
    pageViews: row.page_views,
    visitors: row.visitors,
    engagedSeconds: row.engaged_seconds,
  }));

  const topContent = (db.prepare(`
    SELECT
      COALESCE(NULLIF(content_label, ''), content_id, path) AS label,
      COALESCE(content_type, 'content') AS type,
      COUNT(*) AS views
    FROM analytics_events
    WHERE created_at >= ?
      AND event_type IN ('content_view', 'content_open')
    GROUP BY label, type
    ORDER BY views DESC
    LIMIT 12
  `).all(sinceIso) as Array<{ label: string; type: string; views: number }>);

  const topMedia = (db.prepare(`
    SELECT
      COALESCE(NULLIF(content_label, ''), content_id, 'Untitled media') AS label,
      COALESCE(content_id, '') AS media_id,
      SUM(CASE WHEN event_type = 'media_play' THEN 1 ELSE 0 END) AS plays,
      SUM(CASE WHEN event_type = 'media_complete' THEN 1 ELSE 0 END) AS completions
    FROM analytics_events
    WHERE created_at >= ?
      AND event_type IN ('media_play', 'media_complete')
    GROUP BY label, media_id
    ORDER BY plays DESC, completions DESC
    LIMIT 12
  `).all(sinceIso) as Array<{
    label: string;
    media_id: string;
    plays: number;
    completions: number;
  }>).map((row) => ({
    label: row.label,
    mediaId: row.media_id,
    plays: row.plays,
    completions: row.completions,
  }));

  const devices = (db.prepare(`
    SELECT device_type AS label, COUNT(*) AS value
    FROM analytics_sessions
    WHERE last_seen_at >= ?
    GROUP BY device_type
    ORDER BY value DESC
  `).all(sinceIso) as Array<{ label: string; value: number }>);

  const referrers = (db.prepare(`
    SELECT COALESCE(referrer_host, 'Direct') AS label, COUNT(*) AS value
    FROM analytics_sessions
    WHERE first_seen_at >= ?
    GROUP BY COALESCE(referrer_host, 'Direct')
    ORDER BY value DESC
    LIMIT 8
  `).all(sinceIso) as Array<{ label: string; value: number }>);

  const recentVisitors = (db.prepare(`
    SELECT last_seen_at, entry_path, last_path, device_type, page_views, engaged_seconds
    FROM analytics_sessions
    ORDER BY last_seen_at DESC
    LIMIT 12
  `).all() as Array<{
    last_seen_at: string;
    entry_path: string;
    last_path: string;
    device_type: string;
    page_views: number;
    engaged_seconds: number;
  }>).map((row) => ({
    lastSeenAt: row.last_seen_at,
    entryPath: row.entry_path,
    lastPath: row.last_path,
    deviceType: row.device_type,
    pageViews: row.page_views,
    engagedSeconds: row.engaged_seconds,
  }));

  const syncJobs = (db.prepare(`
    SELECT id, label, last_status, last_started_at, last_finished_at, next_run_at, last_duration_ms
    FROM content_sync_jobs
    ORDER BY next_run_at IS NULL, next_run_at, label
  `).all() as Array<{
    id: string;
    label: string;
    last_status: string | null;
    last_started_at: string | null;
    last_finished_at: string | null;
    next_run_at: string | null;
    last_duration_ms: number | null;
  }>).map((row) => ({
    id: row.id,
    label: row.label,
    status: row.last_status,
    lastStartedAt: row.last_started_at,
    lastFinishedAt: row.last_finished_at,
    nextRunAt: row.next_run_at,
    durationMs: row.last_duration_ms,
  }));

  const recentSyncRuns = (db.prepare(`
    SELECT runs.id, jobs.label, runs.started_at, runs.status, runs.duration_ms, runs.message
    FROM content_sync_runs AS runs
    JOIN content_sync_jobs AS jobs ON jobs.id = runs.job_id
    ORDER BY runs.started_at DESC
    LIMIT 12
  `).all() as Array<{
    id: number;
    label: string;
    started_at: string;
    status: string;
    duration_ms: number | null;
    message: string | null;
  }>).map((row) => ({
    id: row.id,
    label: row.label,
    startedAt: row.started_at,
    status: row.status,
    durationMs: row.duration_ms,
    message: row.message,
  }));

  return {
    days: safeDays,
    summary: {
      pageViews: summary.page_views ?? 0,
      uniqueVisitors: summary.visitors ?? 0,
      engagedMinutes: Math.round((summary.engaged_seconds ?? 0) / 60),
      mediaPlays: summary.media_plays ?? 0,
      activeNow,
    },
    daily,
    topPages,
    topContent,
    topMedia,
    devices,
    referrers,
    recentVisitors,
    syncJobs,
    recentSyncRuns,
  };
}
