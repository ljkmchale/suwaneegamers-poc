import "server-only";
import { getDb } from "@/lib/db";
import { analyticsVisitorToken, audienceSessions, type AnalyticsAudience } from "@/lib/analyticsFilters";

export function getLiveAnalytics(audience: AnalyticsAudience = "all") {
  const updatedAt = new Date().toISOString();
  const threshold = new Date(Date.now() - 120_000).toISOString();
  const visitors = getDb().prepare(`WITH ranked AS (
    SELECT COALESCE(visitor_email, visitor_id, session_id) AS visitorKey,
      COALESCE(visitor_name, visitor_email, 'Unidentified visitor ' || UPPER(SUBSTR(COALESCE(visitor_id,session_id),1,6))) AS visitor,
      last_path AS currentPath, device_type AS device, last_seen_at AS lastSeen,
      page_views AS views,
      ROW_NUMBER() OVER (PARTITION BY COALESCE(visitor_email,visitor_id,session_id) ORDER BY last_seen_at DESC) AS rank
    FROM analytics_sessions WHERE last_seen_at >= ? AND session_id IN (${audienceSessions(audience)})
  ) SELECT visitorKey,visitor,currentPath,device,lastSeen,views FROM ranked WHERE rank=1 ORDER BY lastSeen DESC`).all(threshold) as Array<{
    visitorKey: string; visitor: string; currentPath: string; device: string; lastSeen: string; views: number;
  }>;
  return {
    updatedAt,
    visitors: visitors.map(({ visitorKey, ...visitor }) => ({
      ...visitor,
      visitorToken: analyticsVisitorToken(visitorKey),
    })),
  };
}
export type LiveAnalytics = ReturnType<typeof getLiveAnalytics>;
