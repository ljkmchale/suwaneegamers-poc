import "server-only";

import { createHash } from "crypto";
import { getDb } from "@/lib/db";

const SELF_EMAIL = "larry.m.mchale@gmail.com";
const KNOWN_VISITOR_IDENTITIES = new Map<string, { email: string; name: string }>([
  ["a016fca43f790a8dd13b89acc6f02f4f6ea0ff0d75306c4018368143dc83da83", { email: SELF_EMAIL, name: "Larry McHale" }],
  ["13439a50678cee3d6aa656d5ca9e73bb96d8c2271e104016adfb0a2dab22e457", { email: SELF_EMAIL, name: "Internal testing" }],
  ["1b10c42d40ec5e73c5db1b5cd733669b010a2eb3c0bccb8a55cc70ed95bd0674", { email: SELF_EMAIL, name: "Internal testing" }],
  ["5991d2b167bec013cb028f2b2ee1b2126d7c68ec248f71a16c917a234c82e9ed", { email: SELF_EMAIL, name: "Internal testing" }],
  ["9e8b4eafc0e736bde5670250ce03978200d9230d47916715c4672022de8bec09", { email: SELF_EMAIL, name: "Internal testing" }],
]);

export const ANALYTICS_EVENT_TYPES = [
  "page_view",
  "page_engagement",
  "content_view",
  "content_open",
  "media_play",
  "media_progress",
  "media_complete",
  "internal_click",
  "outbound_click",
  "search_query",
  "search_result_click",
  "search_no_results",
  "scroll_depth",
  "page_exit",
  "page_load",
  "client_error",
  "heartbeat",
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
    visits: number;
    engagedMinutes: number;
    mediaPlays: number;
    clicks: number;
    actionClicks: number;
    searches: number;
    exits: number;
    slowLoads: number;
    clientErrors: number;
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
    progress25: number;
    progress50: number;
    progress75: number;
    completions: number;
  }>;
  topClicks: Array<{
    label: string;
    href: string;
    type: string;
    clicks: number;
  }>;
  clickTypes: Array<{
    type: string;
    clicks: number;
  }>;
  searchTerms: Array<{
    query: string;
    searches: number;
    resultClicks: number;
  }>;
  searchGaps: Array<{
    query: string;
    searches: number;
    resultClicks: number;
    noResults: number;
  }>;
  searchResultChoices: Array<{
    query: string;
    href: string;
    clicks: number;
  }>;
  zeroResultSearches: Array<{
    query: string;
    searches: number;
  }>;
  campaignEngagement: Array<{
    campaign: string;
    pageViews: number;
    visitors: number;
    engagedSeconds: number;
    sessionOpens: number;
    mediaPlays: number;
  }>;
  sessionEngagement: Array<{
    label: string;
    opens: number;
    mediaPlays: number;
  }>;
  performanceIssues: Array<{
    path: string;
    events: number;
    averageMs: number;
    worstMs: number;
  }>;
  clientErrors: Array<{
    label: string;
    path: string;
    count: number;
  }>;
  visitorSegments: Array<{
    segment: string;
    visitors: number;
    sessions: number;
    pageViews: number;
    engagedSeconds: number;
  }>;
  pageDepth: Array<{
    path: string;
    pageLabel: string;
    visitors: number;
    maxDepth: number;
    depthEvents: number;
  }>;
  exitPages: Array<{
    path: string;
    exits: number;
    engagedSeconds: number;
  }>;
  journeyPaths: Array<{
    fromPath: string;
    toPath: string;
    transitions: number;
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
    visitorLabel: string;
    visitorName: string | null;
    visitorEmail: string | null;
  }>;
  people: Array<{
    visitorKey: string;
    name: string;
    email: string | null;
    signedIn: boolean;
    sessions: number;
    pageViews: number;
    engagedSeconds: number;
    lastSeenAt: string;
    pagesViewed: number;
    topPage: string;
  }>;
  memberPageActivity: Array<{
    visitorKey: string;
    name: string;
    email: string | null;
    signedIn: boolean;
    path: string;
    pageLabel: string;
    pageViews: number;
    engagedSeconds: number;
    firstViewedAt: string;
    lastViewedAt: string;
  }>;
  pageAudiences: Array<{
    path: string;
    pageLabel: string;
    pageViews: number;
    people: number;
    visitorNames: string[];
    lastViewedAt: string;
  }>;
  activeVisitors: Array<{
    visitor: string;
    currentPath: string;
    deviceType: string;
    lastSeenAt: string;
    pageViews: number;
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
  const durationMax = candidate.eventType === "page_load" ? 600_000 : 3_600;
  return {
    eventType: candidate.eventType as AnalyticsEventType,
    path,
    contentType: cleanText(candidate.contentType, 40),
    contentId: cleanText(candidate.contentId, 300),
    contentLabel: cleanText(candidate.contentLabel, 160),
    durationSeconds: Math.min(durationMax, Math.max(0, Math.round(Number(candidate.durationSeconds) || 0))),
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
  rawVisitorId?: string;
  events: UsageEventInput[];
  referrer?: string;
  userAgent?: string;
  identity?: { email?: string; name?: string };
}): void {
  const db = getDb();
  const sessionId = anonymizeSessionId(input.rawSessionId);
  const visitorId = input.rawVisitorId ? anonymizeSessionId(input.rawVisitorId) : sessionId;
  const now = new Date().toISOString();
  const internalIdentity = KNOWN_VISITOR_IDENTITIES.get(visitorId) ?? null;
  const knownIdentity = input.identity || internalIdentity
    ? null
    : db.prepare(`
        SELECT visitor_email, visitor_name
        FROM analytics_sessions
        WHERE visitor_id = ? AND visitor_email IS NOT NULL
        ORDER BY last_seen_at DESC
        LIMIT 1
      `).get(visitorId) as { visitor_email: string; visitor_name: string | null } | undefined;
  const visitorEmail = cleanText(input.identity?.email ?? internalIdentity?.email ?? knownIdentity?.visitor_email, 200) ?? null;
  const visitorName = cleanText(input.identity?.name ?? internalIdentity?.name ?? knownIdentity?.visitor_name, 120) ?? null;
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
      (session_id, first_seen_at, last_seen_at, entry_path, last_path, referrer_host, device_type, visitor_id, visitor_email, visitor_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO NOTHING
  `);
  const updateIdentity = db.prepare(`
    UPDATE analytics_sessions
    SET visitor_id = ?, visitor_email = ?, visitor_name = ?
    WHERE session_id = ?
  `);
  const backfillVisitorIdentity = db.prepare(`
    UPDATE analytics_sessions
    SET visitor_email = ?, visitor_name = COALESCE(?, visitor_name)
    WHERE visitor_id = ? AND visitor_email IS NULL
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
    insertSession.run(sessionId, now, now, entryPath, entryPath, referrerHost, deviceType, visitorId, visitorEmail, visitorName);
    // Backfill identity on sessions that started before sign-in resolved.
    updateIdentity.run(visitorId, visitorEmail, visitorName, sessionId);
    if (visitorEmail) {
      backfillVisitorIdentity.run(visitorEmail, visitorName, visitorId);
    }
    for (const event of input.events) {
      if (event.eventType !== "heartbeat") {
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
  const applyKnownIdentity = db.prepare(`
    UPDATE analytics_sessions
    SET visitor_id = COALESCE(visitor_id, ?), visitor_email = ?, visitor_name = ?
    WHERE visitor_id = ? OR (visitor_id IS NULL AND session_id = ?)
  `);
  db.transaction(() => {
    for (const [visitorId, identity] of KNOWN_VISITOR_IDENTITIES) {
      applyKnownIdentity.run(visitorId, identity.email, identity.name, visitorId, visitorId);
    }
  })();
  const safeDays = [7, 30, 90].includes(days) ? days : 30;
  const since = new Date(Date.now() - (safeDays - 1) * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const summary = db.prepare(`
    SELECT
      SUM(CASE WHEN e.event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      COUNT(DISTINCT e.session_id) AS visits,
      COUNT(DISTINCT COALESCE(s.visitor_email, s.visitor_id, e.session_id)) AS visitors,
      SUM(CASE WHEN e.event_type = 'page_engagement' THEN e.duration_seconds ELSE 0 END) AS engaged_seconds,
      SUM(CASE WHEN e.event_type = 'media_play' THEN 1 ELSE 0 END) AS media_plays,
      SUM(CASE WHEN e.event_type IN ('internal_click', 'outbound_click', 'search_result_click') THEN 1 ELSE 0 END) AS clicks,
      SUM(CASE WHEN e.event_type IN ('internal_click', 'outbound_click', 'search_result_click') AND COALESCE(e.content_type, '') NOT IN ('nav', 'footer', 'utility') THEN 1 ELSE 0 END) AS action_clicks,
      SUM(CASE WHEN e.event_type IN ('search_query', 'search_no_results') THEN 1 ELSE 0 END) AS searches,
      SUM(CASE WHEN e.event_type = 'page_exit' THEN 1 ELSE 0 END) AS exits,
      SUM(CASE WHEN e.event_type = 'page_load' AND e.duration_seconds >= 3000 THEN 1 ELSE 0 END) AS slow_loads,
      SUM(CASE WHEN e.event_type = 'client_error' THEN 1 ELSE 0 END) AS client_errors
    FROM analytics_events AS e
    JOIN analytics_sessions AS s ON s.session_id = e.session_id
    WHERE e.created_at >= ?
  `).get(sinceIso) as {
    page_views: number | null;
    visits: number | null;
    visitors: number | null;
    engaged_seconds: number | null;
    media_plays: number | null;
    clicks: number | null;
    action_clicks: number | null;
    searches: number | null;
    exits: number | null;
    slow_loads: number | null;
    client_errors: number | null;
  };

  const activeThreshold = new Date(Date.now() - 2 * 60_000).toISOString();
  const activeNow = (db.prepare(`
    SELECT COUNT(DISTINCT COALESCE(visitor_email, visitor_id, session_id)) AS count
    FROM analytics_sessions
    WHERE last_seen_at >= ?
  `).get(activeThreshold) as { count: number }).count;

  const dailyRows = db.prepare(`
    SELECT
      date(created_at, 'localtime') AS date,
      SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      COUNT(DISTINCT COALESCE(s.visitor_email, s.visitor_id, e.session_id)) AS visitors,
      SUM(CASE WHEN event_type = 'page_engagement' THEN duration_seconds ELSE 0 END) AS engaged_seconds,
      SUM(CASE WHEN event_type = 'media_play' THEN 1 ELSE 0 END) AS media_plays
    FROM analytics_events AS e
    JOIN analytics_sessions AS s ON s.session_id = e.session_id
    WHERE e.created_at >= ?
    GROUP BY date(e.created_at, 'localtime')
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
      e.path,
      SUM(CASE WHEN e.event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      COUNT(DISTINCT COALESCE(s.visitor_email, s.visitor_id, e.session_id)) AS visitors,
      SUM(CASE WHEN e.event_type = 'page_engagement' THEN e.duration_seconds ELSE 0 END) AS engaged_seconds
    FROM analytics_events AS e
    JOIN analytics_sessions AS s ON s.session_id = e.session_id
    WHERE e.created_at >= ?
    GROUP BY e.path
    HAVING page_views > 0 OR engaged_seconds > 0
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
      SUM(CASE WHEN event_type = 'media_progress' AND duration_seconds >= 25 THEN 1 ELSE 0 END) AS progress_25,
      SUM(CASE WHEN event_type = 'media_progress' AND duration_seconds >= 50 THEN 1 ELSE 0 END) AS progress_50,
      SUM(CASE WHEN event_type = 'media_progress' AND duration_seconds >= 75 THEN 1 ELSE 0 END) AS progress_75,
      SUM(CASE WHEN event_type = 'media_complete' THEN 1 ELSE 0 END) AS completions
    FROM analytics_events
    WHERE created_at >= ?
      AND event_type IN ('media_play', 'media_progress', 'media_complete')
    GROUP BY label, media_id
    ORDER BY plays DESC, completions DESC
    LIMIT 12
  `).all(sinceIso) as Array<{
    label: string;
    media_id: string;
    plays: number;
    progress_25: number;
    progress_50: number;
    progress_75: number;
    completions: number;
  }>).map((row) => ({
    label: row.label,
    mediaId: row.media_id,
    plays: row.plays,
    progress25: row.progress_25,
    progress50: row.progress_50,
    progress75: row.progress_75,
    completions: row.completions,
  }));

  const topClicks = (db.prepare(`
    SELECT
      COALESCE(NULLIF(content_label, ''), content_id, path) AS label,
      COALESCE(content_id, path) AS href,
      COALESCE(NULLIF(content_type, ''), CASE WHEN event_type = 'outbound_click' THEN 'outbound' ELSE 'content' END) AS type,
      COUNT(*) AS clicks
    FROM analytics_events
    WHERE created_at >= ?
      AND event_type IN ('internal_click', 'outbound_click', 'search_result_click')
      AND COALESCE(content_type, '') NOT IN ('nav', 'footer', 'utility')
    GROUP BY label, href, type
    ORDER BY clicks DESC, label
    LIMIT 12
  `).all(sinceIso) as Array<{
    label: string;
    href: string;
    type: string;
    clicks: number;
  }>);

  const clickTypes = (db.prepare(`
    SELECT
      COALESCE(NULLIF(content_type, ''), CASE WHEN event_type = 'outbound_click' THEN 'outbound' ELSE 'content' END) AS type,
      COUNT(*) AS clicks
    FROM analytics_events
    WHERE created_at >= ?
      AND event_type IN ('internal_click', 'outbound_click', 'search_result_click')
    GROUP BY type
    ORDER BY clicks DESC, type
  `).all(sinceIso) as Array<{ type: string; clicks: number }>);

  const searchTerms = (db.prepare(`
    SELECT
      COALESCE(NULLIF(content_label, ''), content_id, 'Unknown search') AS query,
      SUM(CASE WHEN event_type IN ('search_query', 'search_no_results') THEN 1 ELSE 0 END) AS searches,
      SUM(CASE WHEN event_type = 'search_result_click' THEN 1 ELSE 0 END) AS result_clicks
    FROM analytics_events
    WHERE created_at >= ?
      AND event_type IN ('search_query', 'search_no_results', 'search_result_click')
    GROUP BY query
    HAVING searches > 0 OR result_clicks > 0
    ORDER BY searches DESC, result_clicks DESC, query
    LIMIT 12
  `).all(sinceIso) as Array<{
    query: string;
    searches: number;
    result_clicks: number;
  }>).map((row) => ({
    query: row.query,
    searches: row.searches,
    resultClicks: row.result_clicks,
  }));

  const zeroResultSearches = (db.prepare(`
    SELECT
      COALESCE(NULLIF(content_label, ''), content_id, 'Unknown search') AS query,
      COUNT(*) AS searches
    FROM analytics_events
    WHERE created_at >= ?
      AND event_type = 'search_no_results'
    GROUP BY query
    ORDER BY searches DESC, query
    LIMIT 12
  `).all(sinceIso) as Array<{ query: string; searches: number }>);

  const searchGaps = (db.prepare(`
    SELECT
      COALESCE(NULLIF(content_label, ''), content_id, 'Unknown search') AS query,
      SUM(CASE WHEN event_type IN ('search_query', 'search_no_results') THEN 1 ELSE 0 END) AS searches,
      SUM(CASE WHEN event_type = 'search_result_click' THEN 1 ELSE 0 END) AS result_clicks,
      SUM(CASE WHEN event_type = 'search_no_results' THEN 1 ELSE 0 END) AS no_results
    FROM analytics_events
    WHERE created_at >= ?
      AND event_type IN ('search_query', 'search_no_results', 'search_result_click')
    GROUP BY query
    HAVING no_results > 0 OR result_clicks = 0
    ORDER BY no_results DESC, searches DESC, query
    LIMIT 12
  `).all(sinceIso) as Array<{
    query: string;
    searches: number;
    result_clicks: number;
    no_results: number;
  }>).map((row) => ({
    query: row.query,
    searches: row.searches,
    resultClicks: row.result_clicks,
    noResults: row.no_results,
  }));

  const searchResultChoices = (db.prepare(`
    SELECT
      COALESCE(NULLIF(content_label, ''), 'Unknown search') AS query,
      COALESCE(content_id, '') AS href,
      COUNT(*) AS clicks
    FROM analytics_events
    WHERE created_at >= ?
      AND event_type = 'search_result_click'
    GROUP BY query, href
    ORDER BY clicks DESC, query
    LIMIT 12
  `).all(sinceIso) as Array<{ query: string; href: string; clicks: number }>);

  const pageDepth = (db.prepare(`
    SELECT
      e.path,
      COALESCE(MAX(CASE WHEN e.event_type = 'page_view' THEN NULLIF(e.content_label, '') END), e.path) AS page_label,
      COUNT(DISTINCT COALESCE(s.visitor_email, s.visitor_id, e.session_id)) AS visitors,
      MAX(CASE WHEN e.event_type = 'scroll_depth' THEN e.duration_seconds ELSE 0 END) AS max_depth,
      SUM(CASE WHEN e.event_type = 'scroll_depth' THEN 1 ELSE 0 END) AS depth_events
    FROM analytics_events AS e
    JOIN analytics_sessions AS s ON s.session_id = e.session_id
    WHERE e.created_at >= ?
      AND e.event_type IN ('page_view', 'scroll_depth')
    GROUP BY e.path
    HAVING depth_events > 0
    ORDER BY max_depth DESC, visitors DESC, depth_events DESC
    LIMIT 12
  `).all(sinceIso) as Array<{
    path: string;
    page_label: string;
    visitors: number;
    max_depth: number;
    depth_events: number;
  }>).map((row) => ({
    path: row.path,
    pageLabel: row.page_label,
    visitors: row.visitors,
    maxDepth: row.max_depth,
    depthEvents: row.depth_events,
  }));

  const exitPages = (db.prepare(`
    SELECT
      e.path,
      COUNT(*) AS exits,
      SUM(e.duration_seconds) AS engaged_seconds
    FROM analytics_events AS e
    WHERE e.created_at >= ?
      AND e.event_type = 'page_exit'
    GROUP BY e.path
    ORDER BY exits DESC, engaged_seconds DESC
    LIMIT 12
  `).all(sinceIso) as Array<{
    path: string;
    exits: number;
    engaged_seconds: number;
  }>).map((row) => ({
    path: row.path,
    exits: row.exits,
    engagedSeconds: row.engaged_seconds,
  }));

  const journeyPaths = (db.prepare(`
    WITH page_views AS (
      SELECT
        e.session_id,
        e.path,
        e.created_at,
        LEAD(e.path) OVER (PARTITION BY e.session_id ORDER BY e.created_at, e.id) AS next_path
      FROM analytics_events AS e
      WHERE e.created_at >= ?
        AND e.event_type = 'page_view'
    )
    SELECT path AS from_path, next_path AS to_path, COUNT(*) AS transitions
    FROM page_views
    WHERE next_path IS NOT NULL
      AND next_path != path
    GROUP BY path, next_path
    ORDER BY transitions DESC, from_path, to_path
    LIMIT 12
  `).all(sinceIso) as Array<{
    from_path: string;
    to_path: string;
    transitions: number;
  }>).map((row) => ({
    fromPath: row.from_path,
    toPath: row.to_path,
    transitions: row.transitions,
  }));

  const campaignEngagement = (db.prepare(`
    WITH campaign_events AS (
      SELECT
        CASE
          WHEN e.path LIKE '/campaigns/%' THEN substr(e.path, length('/campaigns/') + 1)
          WHEN e.content_type = 'session summary' AND instr(COALESCE(e.content_id, ''), ':') > 0
            THEN substr(e.content_id, 1, instr(e.content_id, ':') - 1)
          WHEN e.content_type = 'session recording' AND instr(COALESCE(e.content_label, ''), ' - ') > 0
            THEN lower(replace(substr(e.content_label, 1, instr(e.content_label, ' - ') - 1), ' ', '-'))
          ELSE NULL
        END AS campaign,
        e.event_type,
        e.duration_seconds,
        COALESCE(s.visitor_email, s.visitor_id, e.session_id) AS visitor_key
      FROM analytics_events AS e
      JOIN analytics_sessions AS s ON s.session_id = e.session_id
      WHERE e.created_at >= ?
    )
    SELECT
      campaign,
      SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      COUNT(DISTINCT visitor_key) AS visitors,
      SUM(CASE WHEN event_type = 'page_engagement' THEN duration_seconds ELSE 0 END) AS engaged_seconds,
      SUM(CASE WHEN event_type = 'content_open' THEN 1 ELSE 0 END) AS session_opens,
      SUM(CASE WHEN event_type = 'media_play' THEN 1 ELSE 0 END) AS media_plays
    FROM campaign_events
    WHERE campaign IS NOT NULL AND campaign != ''
    GROUP BY campaign
    ORDER BY page_views DESC, engaged_seconds DESC, session_opens DESC
    LIMIT 12
  `).all(sinceIso) as Array<{
    campaign: string;
    page_views: number;
    visitors: number;
    engaged_seconds: number;
    session_opens: number;
    media_plays: number;
  }>).map((row) => ({
    campaign: row.campaign,
    pageViews: row.page_views,
    visitors: row.visitors,
    engagedSeconds: row.engaged_seconds,
    sessionOpens: row.session_opens,
    mediaPlays: row.media_plays,
  }));

  const sessionEngagement = (db.prepare(`
    SELECT
      COALESCE(NULLIF(content_label, ''), content_id, 'Untitled session') AS label,
      SUM(CASE WHEN event_type = 'content_open' THEN 1 ELSE 0 END) AS opens,
      SUM(CASE WHEN event_type = 'media_play' THEN 1 ELSE 0 END) AS media_plays
    FROM analytics_events
    WHERE created_at >= ?
      AND content_type IN ('session summary', 'session recording')
      AND event_type IN ('content_open', 'media_play')
    GROUP BY label
    ORDER BY opens DESC, media_plays DESC, label
    LIMIT 12
  `).all(sinceIso) as Array<{
    label: string;
    opens: number;
    media_plays: number;
  }>).map((row) => ({
    label: row.label,
    opens: row.opens,
    mediaPlays: row.media_plays,
  }));

  const performanceIssues = (db.prepare(`
    SELECT
      path,
      COUNT(*) AS events,
      AVG(duration_seconds) AS average_ms,
      MAX(duration_seconds) AS worst_ms
    FROM analytics_events
    WHERE created_at >= ?
      AND event_type = 'page_load'
      AND duration_seconds >= 3000
    GROUP BY path
    ORDER BY worst_ms DESC, events DESC
    LIMIT 12
  `).all(sinceIso) as Array<{
    path: string;
    events: number;
    average_ms: number;
    worst_ms: number;
  }>).map((row) => ({
    path: row.path,
    events: row.events,
    averageMs: Math.round(row.average_ms),
    worstMs: row.worst_ms,
  }));

  const clientErrors = (db.prepare(`
    SELECT
      COALESCE(NULLIF(content_label, ''), content_id, 'Client error') AS label,
      path,
      COUNT(*) AS count
    FROM analytics_events
    WHERE created_at >= ?
      AND event_type = 'client_error'
    GROUP BY label, path
    ORDER BY count DESC, label
    LIMIT 12
  `).all(sinceIso) as Array<{
    label: string;
    path: string;
    count: number;
  }>);

  const visitorSegments = (db.prepare(`
    SELECT
      CASE
        WHEN s.visitor_email = 'larry.m.mchale@gmail.com' THEN 'Self / admin'
        WHEN s.visitor_email IS NOT NULL THEN 'Signed-in members'
        ELSE 'Unidentified visitors'
      END AS segment,
      COUNT(DISTINCT COALESCE(s.visitor_email, s.visitor_id, s.session_id)) AS visitors,
      COUNT(DISTINCT s.session_id) AS sessions,
      SUM(CASE WHEN e.event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      SUM(CASE WHEN e.event_type = 'page_engagement' THEN e.duration_seconds ELSE 0 END) AS engaged_seconds
    FROM analytics_events AS e
    JOIN analytics_sessions AS s ON s.session_id = e.session_id
    WHERE e.created_at >= ?
    GROUP BY segment
    ORDER BY page_views DESC, engaged_seconds DESC
  `).all(sinceIso) as Array<{
    segment: string;
    visitors: number;
    sessions: number;
    page_views: number;
    engaged_seconds: number;
  }>).map((row) => ({
    segment: row.segment,
    visitors: row.visitors,
    sessions: row.sessions,
    pageViews: row.page_views,
    engagedSeconds: row.engaged_seconds,
  }));

  const devices = (db.prepare(`
    SELECT device_type AS label, COUNT(*) AS value
    FROM analytics_sessions
    WHERE last_seen_at >= ?
    GROUP BY device_type
    ORDER BY value DESC
  `).all(sinceIso) as Array<{ label: string; value: number }>);

  const referrers = (db.prepare(`
    SELECT
      CASE
        WHEN referrer_host IS NULL THEN 'Direct'
        WHEN referrer_host IN ('suwaneegamers.net', 'www.suwaneegamers.net', 'localhost', '127.0.0.1') THEN 'Same site'
        WHEN referrer_host = 'accounts.google.com' THEN 'Google sign-in'
        ELSE referrer_host
      END AS label,
      COUNT(*) AS value
    FROM analytics_sessions
    WHERE first_seen_at >= ?
    GROUP BY label
    ORDER BY value DESC
    LIMIT 8
  `).all(sinceIso) as Array<{ label: string; value: number }>);

  const recentVisitors = (db.prepare(`
    SELECT
      last_seen_at,
      entry_path,
      last_path,
      device_type,
      page_views,
      engaged_seconds,
      visitor_email,
      visitor_name,
      COALESCE(
        visitor_name,
        visitor_email,
        'Unidentified visitor ' || UPPER(SUBSTR(COALESCE(visitor_id, session_id), 1, 6))
      ) AS visitor_label
    FROM analytics_sessions
    WHERE last_seen_at >= ?
    ORDER BY last_seen_at DESC
    LIMIT 12
  `).all(sinceIso) as Array<{
    last_seen_at: string;
    entry_path: string;
    last_path: string;
    device_type: string;
    page_views: number;
    engaged_seconds: number;
    visitor_email: string | null;
    visitor_name: string | null;
    visitor_label: string;
  }>).map((row) => ({
    lastSeenAt: row.last_seen_at,
    entryPath: row.entry_path,
    lastPath: row.last_path,
    deviceType: row.device_type,
    pageViews: row.page_views,
    engagedSeconds: row.engaged_seconds,
    visitorLabel: row.visitor_label,
    visitorName: row.visitor_name,
    visitorEmail: row.visitor_email,
  }));

  const people = (db.prepare(`
    SELECT
      COALESCE(s.visitor_email, s.visitor_id, s.session_id) AS visitor_key,
      MAX(s.visitor_email) AS email,
      COALESCE(
        MAX(s.visitor_name),
        MAX(s.visitor_email),
        'Unidentified visitor ' || UPPER(SUBSTR(COALESCE(s.visitor_id, s.session_id), 1, 6))
      ) AS name,
      COUNT(DISTINCT s.session_id) AS sessions,
      SUM(CASE WHEN e.event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      SUM(CASE WHEN e.event_type = 'page_engagement' THEN e.duration_seconds ELSE 0 END) AS engaged_seconds,
      MAX(e.created_at) AS last_seen_at
    FROM analytics_events AS e
    JOIN analytics_sessions AS s ON s.session_id = e.session_id
    WHERE e.created_at >= ?
    GROUP BY COALESCE(s.visitor_email, s.visitor_id, s.session_id)
    ORDER BY last_seen_at DESC
    LIMIT 50
  `).all(sinceIso) as Array<{
    visitor_key: string;
    email: string | null;
    name: string;
    sessions: number;
    page_views: number;
    engaged_seconds: number;
    last_seen_at: string;
  }>).map((row) => ({
    visitorKey: row.visitor_key,
    email: row.email,
    name: row.name,
    signedIn: row.email !== null,
    sessions: row.sessions,
    pageViews: row.page_views,
    engagedSeconds: row.engaged_seconds,
    lastSeenAt: row.last_seen_at,
    pagesViewed: 0,
    topPage: "",
  }));

  const memberPageActivity = (db.prepare(`
    SELECT
      COALESCE(s.visitor_email, s.visitor_id, s.session_id) AS visitor_key,
      MAX(s.visitor_email) AS email,
      COALESCE(
        MAX(s.visitor_name),
        MAX(s.visitor_email),
        'Unidentified visitor ' || UPPER(SUBSTR(COALESCE(s.visitor_id, s.session_id), 1, 6))
      ) AS name,
      e.path,
      COALESCE(MAX(CASE WHEN e.event_type = 'page_view' THEN NULLIF(e.content_label, '') END), e.path) AS page_label,
      SUM(CASE WHEN e.event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      SUM(CASE WHEN e.event_type = 'page_engagement' THEN e.duration_seconds ELSE 0 END) AS engaged_seconds,
      MIN(e.created_at) AS first_viewed_at,
      MAX(e.created_at) AS last_viewed_at
    FROM analytics_events AS e
    JOIN analytics_sessions AS s ON s.session_id = e.session_id
    WHERE e.created_at >= ?
      AND e.event_type IN ('page_view', 'page_engagement')
    GROUP BY COALESCE(s.visitor_email, s.visitor_id, s.session_id), e.path
    HAVING page_views > 0 OR engaged_seconds > 0
    ORDER BY last_viewed_at DESC
  `).all(sinceIso) as Array<{
    visitor_key: string;
    email: string | null;
    name: string;
    path: string;
    page_label: string;
    page_views: number;
    engaged_seconds: number;
    first_viewed_at: string;
    last_viewed_at: string;
  }>).map((row) => ({
    visitorKey: row.visitor_key,
    name: row.name,
    email: row.email,
    signedIn: row.email !== null,
    path: row.path,
    pageLabel: row.page_label,
    pageViews: row.page_views,
    engagedSeconds: row.engaged_seconds,
    firstViewedAt: row.first_viewed_at,
    lastViewedAt: row.last_viewed_at,
  }));

  const activityByVisitor = new Map<string, typeof memberPageActivity>();
  for (const activity of memberPageActivity) {
    const rows = activityByVisitor.get(activity.visitorKey) ?? [];
    rows.push(activity);
    activityByVisitor.set(activity.visitorKey, rows);
  }
  for (const person of people) {
    const rows = activityByVisitor.get(person.visitorKey) ?? [];
    person.pagesViewed = rows.length;
    person.topPage = [...rows].sort((a, b) => b.pageViews - a.pageViews)[0]?.path ?? "";
  }

  const pageAudiences = (db.prepare(`
    SELECT
      e.path,
      COALESCE(MAX(CASE WHEN e.event_type = 'page_view' THEN NULLIF(e.content_label, '') END), e.path) AS page_label,
      SUM(CASE WHEN e.event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      COUNT(DISTINCT COALESCE(s.visitor_email, s.visitor_id, s.session_id)) AS people,
      GROUP_CONCAT(DISTINCT COALESCE(
        s.visitor_name,
        s.visitor_email,
        'Unidentified visitor ' || UPPER(SUBSTR(COALESCE(s.visitor_id, s.session_id), 1, 6))
      )) AS visitor_names,
      MAX(e.created_at) AS last_viewed_at
    FROM analytics_events AS e
    JOIN analytics_sessions AS s ON s.session_id = e.session_id
    WHERE e.created_at >= ?
      AND e.event_type IN ('page_view', 'page_engagement')
    GROUP BY e.path
    HAVING page_views > 0 OR SUM(CASE WHEN e.event_type = 'page_engagement' THEN e.duration_seconds ELSE 0 END) > 0
    ORDER BY people DESC, page_views DESC
    LIMIT 50
  `).all(sinceIso) as Array<{
    path: string;
    page_label: string;
    page_views: number;
    people: number;
    visitor_names: string | null;
    last_viewed_at: string;
  }>).map((row) => ({
    path: row.path,
    pageLabel: row.page_label,
    pageViews: row.page_views,
    people: row.people,
    visitorNames: row.visitor_names?.split(",") ?? [],
    lastViewedAt: row.last_viewed_at,
  }));

  const activeVisitors = (db.prepare(`
    SELECT session_id, visitor_id, last_path, device_type, last_seen_at, page_views, visitor_name, visitor_email
    FROM (
      SELECT
        session_id,
        visitor_id,
        last_path,
        device_type,
        last_seen_at,
        page_views,
        visitor_name,
        visitor_email,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(visitor_email, visitor_id, session_id)
          ORDER BY last_seen_at DESC
        ) AS visitor_rank
      FROM analytics_sessions
      WHERE last_seen_at >= ?
    )
    WHERE visitor_rank = 1
    ORDER BY last_seen_at DESC
    LIMIT 20
  `).all(activeThreshold) as Array<{
    session_id: string;
    visitor_id: string | null;
    last_path: string;
    device_type: string;
    last_seen_at: string;
    page_views: number;
    visitor_name: string | null;
    visitor_email: string | null;
  }>).map((row) => ({
    visitor: row.visitor_name
      ?? row.visitor_email
      ?? `Unidentified visitor ${(row.visitor_id ?? row.session_id).slice(0, 6).toUpperCase()}`,
    currentPath: row.last_path,
    deviceType: row.device_type,
    lastSeenAt: row.last_seen_at,
    pageViews: row.page_views,
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
      visits: summary.visits ?? 0,
      engagedMinutes: Math.round((summary.engaged_seconds ?? 0) / 60),
      mediaPlays: summary.media_plays ?? 0,
      clicks: summary.clicks ?? 0,
      actionClicks: summary.action_clicks ?? 0,
      searches: summary.searches ?? 0,
      exits: summary.exits ?? 0,
      slowLoads: summary.slow_loads ?? 0,
      clientErrors: summary.client_errors ?? 0,
      activeNow,
    },
    daily,
    topPages,
    topContent,
    topMedia,
    topClicks,
    clickTypes,
    searchTerms,
    searchGaps,
    searchResultChoices,
    zeroResultSearches,
    campaignEngagement,
    sessionEngagement,
    performanceIssues,
    clientErrors,
    visitorSegments,
    pageDepth,
    exitPages,
    journeyPaths,
    devices,
    referrers,
    recentVisitors,
    people,
    memberPageActivity,
    pageAudiences,
    activeVisitors,
    syncJobs,
    recentSyncRuns,
  };
}
