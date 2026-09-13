import "server-only";
import { getDb } from "@/lib/db";
import { analyticsPeriod, audienceSessions, type AnalyticsAudience } from "@/lib/analyticsFilters";

export function getMapInsights(days: number, audience: AnalyticsAudience = "all", visit?: string) {
  const db = getDb();
  const { sinceIso } = analyticsPeriod(days);
  const sessions = audienceSessions(audience);
  const mapEvent = `e.path = '/maps-of-myrdae'`;
  const click = `e.event_type = 'content_view' AND e.content_type IN ('map location', 'map region')`;
  const eligible = `e.created_at >= ? AND e.session_id IN (${sessions})`;
  const totals = db.prepare(`SELECT COUNT(DISTINCT e.session_id) AS visits,
    COUNT(DISTINCT CASE WHEN ${click} THEN e.session_id END) AS interactingVisits,
    SUM(CASE WHEN ${click} THEN 1 ELSE 0 END) AS clicks,
    MIN(CASE WHEN ${click} THEN e.created_at END) AS firstClick,
    MAX(CASE WHEN ${click} THEN e.created_at END) AS lastClick
    FROM analytics_events e WHERE ${eligible} AND ${mapEvent}`).get(sinceIso) as {
      visits: number; interactingVisits: number; clicks: number | null; firstClick: string | null; lastClick: string | null;
    };
  // Observed receipt is evidence of collection, not proof of complete historical coverage.
  const coverage = db.prepare(`SELECT MIN(e.created_at) AS firstReceived, MAX(e.created_at) AS lastReceived
    FROM analytics_events e WHERE ${mapEvent} AND ${click}`).get() as { firstReceived: string | null; lastReceived: string | null };
  const locations = db.prepare(`SELECT e.content_id AS id, e.content_type AS kind,
    MAX(COALESCE(NULLIF(e.content_label, ''), e.content_id)) AS label, COUNT(*) AS clicks,
    COUNT(DISTINCT e.session_id) AS visits,
    COUNT(DISTINCT COALESCE(s.visitor_email, s.visitor_id, e.session_id)) AS visitors,
    MAX(e.created_at) AS lastSeen
    FROM analytics_events e JOIN analytics_sessions s ON s.session_id = e.session_id
    WHERE ${eligible} AND ${mapEvent} AND ${click}
    GROUP BY e.content_id, e.content_type ORDER BY visitors DESC, clicks DESC`).all(sinceIso) as Array<{
      id: string; kind: string; label: string; clicks: number; visits: number; visitors: number; lastSeen: string;
    }>;
  const journeys = db.prepare(`WITH pages AS (
    SELECT e.path, e.created_at, e.session_id,
      LAG(e.path) OVER (PARTITION BY e.session_id ORDER BY e.created_at, e.id) AS previous,
      LEAD(e.path) OVER (PARTITION BY e.session_id ORDER BY e.created_at, e.id) AS next
    FROM analytics_events e WHERE ${eligible} AND e.event_type = 'page_view'
  ) SELECT p.session_id AS visitId,
    COALESCE(s.visitor_name, s.visitor_email,
      'Unidentified visitor ' || UPPER(SUBSTR(COALESCE(s.visitor_id, s.session_id), 1, 6))) AS visitor,
    p.created_at AS openedAt,
    COALESCE(p.previous, 'First recorded page in period') AS previous,
    COALESCE(p.next, 'No later page recorded') AS next
    FROM pages p JOIN analytics_sessions s ON s.session_id = p.session_id
    WHERE p.path = '/maps-of-myrdae' ORDER BY p.created_at DESC`).all(sinceIso) as Array<{
      visitId: string; visitor: string; openedAt: string; previous: string; next: string;
    }>;
  const visits = db.prepare(`SELECT s.session_id AS id,
    COALESCE(s.visitor_name, s.visitor_email, 'Unidentified visitor ' || UPPER(SUBSTR(COALESCE(s.visitor_id, s.session_id), 1, 6))) AS visitor,
    COALESCE(
      CASE WHEN s.utm_source IS NOT NULL THEN s.utm_source || CASE WHEN s.utm_medium IS NOT NULL THEN ' / ' || s.utm_medium ELSE '' END END,
      CASE WHEN s.referrer_host = 'accounts.google.com' THEN 'Google sign-in (legacy)' ELSE s.referrer_host END,
      'Unknown / direct'
    ) AS source,
    s.utm_campaign AS campaign, COALESCE(s.acquisition_path, s.entry_path) AS entry,
    s.device_type AS device, MIN(e.created_at) AS firstSeen, MAX(e.created_at) AS lastSeen,
    SUM(CASE WHEN e.event_type = 'page_view' THEN 1 ELSE 0 END) AS views,
    SUM(CASE WHEN ${click} THEN 1 ELSE 0 END) AS clicks,
    SUM(CASE WHEN e.event_type = 'page_engagement' THEN e.duration_seconds ELSE 0 END) AS engagedSeconds,
    CASE WHEN (SELECT MIN(h.first_seen_at) FROM analytics_sessions h
      WHERE COALESCE(h.visitor_email, h.visitor_id, h.session_id) = COALESCE(s.visitor_email, s.visitor_id, s.session_id)) >= ?
      THEN 'First seen in period' ELSE 'Seen before period' END AS cohort
    FROM analytics_events e JOIN analytics_sessions s ON s.session_id=e.session_id
    WHERE ${eligible} AND ${mapEvent} GROUP BY s.session_id ORDER BY lastSeen DESC`).all(sinceIso, sinceIso) as Array<{
      id: string; visitor: string; source: string; campaign: string | null; entry: string; device: string;
      firstSeen: string; lastSeen: string; views: number; clicks: number; engagedSeconds: number; cohort: string;
    }>;
  const selectedVisit = visits.find((row) => row.id === visit);
  const timeline = selectedVisit ? db.prepare(`SELECT created_at AS at, path,
    event_type AS event, content_type AS kind, COALESCE(content_label, content_id) AS target,
    duration_seconds AS value FROM analytics_events
    WHERE session_id = ? AND created_at >= ? AND event_type <> 'heartbeat'
    ORDER BY created_at, id`).all(selectedVisit.id, sinceIso) as Array<{
      at: string; path: string; event: string; kind: string | null; target: string | null; value: number | null;
    }> : [];
  return { totals, coverage, locations, journeys, visits, selectedVisit, timeline };
}
