// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({ db: null as unknown as Database.Database }));
vi.mock("@/lib/db", () => ({ getDb: () => state.db }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { getAnalyticsDashboardData, getVisitorGrowthSummary } from "@/lib/analytics";
import { getMapInsights } from "@/lib/mapInsights";
import { InsightsPage, INSIGHT_VIEWS, type InsightView } from "@/app/admin/analytics/InsightsPage";
import { analyticsAudience } from "@/lib/analyticsFilters";

const now = "2026-09-12T16:00:00.000Z";
function session(id: string, email: string | null, referrer: string | null = null, source: string | null = null) {
  state.db.prepare(`INSERT INTO analytics_sessions
    (session_id,visitor_id,visitor_email,visitor_name,first_seen_at,last_seen_at,entry_path,last_path,referrer_host,utm_source)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id,id,email,email ? "Name, with comma" : null,now,now,"/","/maps-of-myrdae",referrer,source);
}
function event(id: string, path: string, type = "page_view", label: string | null = null, contentId: string | null = null, kind: string | null = null, at = now) {
  state.db.prepare(`INSERT INTO analytics_events(session_id,path,event_type,content_label,content_id,content_type,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(id,path,type,label,contentId,kind,at);
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(now));
  state.db = new Database(":memory:");
  state.db.exec(readFileSync(resolve("__tests__/fixtures/analytics-reporting-schema.sql"), "utf8"));
  session("owner", "larry.m.mchale@gmail.com");
  session("member", "member@example.test", "accounts.google.com", "discord");
  session("anon", null);
  session("local", null, "localhost");
  for (const id of ["owner","member","anon","local"]) event(id,"/maps-of-myrdae");
});
afterEach(() => { state.db.close(); vi.useRealTimers(); });

describe("analytics reporting queries", () => {
  it("scopes every summary to the selected audience and normalizes unknown input", () => {
    expect(analyticsAudience("'; DROP TABLE analytics_events;")).toBe("all");
    for (const [audience,count] of [["all",4],["external",2],["members",1],["unidentified",1],["internal",2]] as const) {
      const data = getAnalyticsDashboardData(30,audience,true);
      expect(data.summary.uniqueVisitors).toBe(count);
      expect(data.summary.pageViews).toBe(count);
      expect(data.summary.activeNow).toBe(count);
      expect(data.people).toHaveLength(count);
      expect(data.recentVisitors).toHaveLength(count);
      expect(data.devices.reduce((sum,row)=>sum+row.value,0)).toBe(count);
      expect(data.referrers.reduce((sum,row)=>sum+row.value,0)).toBe(count);
      expect(data.mapActivity.visitors).toBe(count);
      expect(getVisitorGrowthSummary(30,audience).newVisitorCount).toBe(count);
    }
  });
  it("uses campaign acquisition consistently and preserves names containing commas", () => {
    const data = getAnalyticsDashboardData(30,"members",true);
    expect(data.referrers).toEqual([{label:"discord",value:1}]);
    expect(data.recentVisitors[0].acquisitionSource).toBe("discord");
    expect(data.pageAudiences[0].visitorNames).toEqual(["Name, with comma"]);
  });
  it("keeps complete report rows beyond the old caps and includes only in-period job history", () => {
    for(let i=0;i<55;i++){ session(`extra-${i}`,null); event(`extra-${i}`,`/page-${i}`); }
    state.db.exec(`INSERT INTO content_sync_jobs(id,label,schedule,command) VALUES ('job','Example','daily','example');`);
    state.db.prepare("INSERT INTO content_sync_runs(job_id,started_at,status) VALUES ('job',?,'failed')").run("2026-01-01T00:00:00Z");
    const data=getAnalyticsDashboardData(30,"all",true);
    expect(data.people).toHaveLength(59);
    expect(data.pageAudiences).toHaveLength(56);
    expect(data.topPages).toHaveLength(56);
    expect(data.recentSyncRuns).toHaveLength(0);
    expect(data.syncJobs).toHaveLength(1);
  });
  it("distinguishes repeat clicks, visitors and stable map IDs, and scopes timelines", () => {
    event("member","/maps-of-myrdae","content_view","Old name","one","map location");
    event("member","/maps-of-myrdae","content_view","New name","one","map location");
    event("member","/maps-of-myrdae","content_view","New name","two","map location");
    event("owner","/maps-of-myrdae","content_view","Internal","three","map region");
    event("member","/gazetteer");
    const report=getMapInsights(30,"external","member");
    expect(report.totals).toMatchObject({visits:2,interactingVisits:1,clicks:3});
    expect(report.locations).toHaveLength(2);
    expect(report.locations.find(r=>r.id==="one")).toMatchObject({visitors:1,visits:1,clicks:2});
    expect(report.journeys.some(r=>r.next==="/gazetteer")).toBe(true);
    expect(report.timeline).toHaveLength(5);
    expect(getMapInsights(30,"external","owner").timeline).toEqual([]);
  });
  it("reports no received clicks without inferring zero interaction coverage", () => {
    expect(getMapInsights(30).coverage.firstReceived).toBeNull();
    state.db.exec("DELETE FROM analytics_events; DELETE FROM analytics_sessions;");
    expect(getAnalyticsDashboardData(7,"all",true).summary.uniqueVisitors).toBe(0);
    expect(getMapInsights(7).totals.visits).toBe(0);
  });
  it("renders every reporting view with the selected audience and without query failures", async () => {
    for(const view of Object.keys(INSIGHT_VIEWS) as InsightView[]){
      const html=renderToStaticMarkup(await InsightsPage({view,searchParams:Promise.resolve({days:"7",audience:"external"})}));
      expect(html).toContain(INSIGHT_VIEWS[view].replaceAll("&","&amp;"));
      expect(html).toContain("Exclude internal");
      expect(html).not.toContain("NaN");
      if(view==="maps") expect(html).toContain("No location or region signals have reached");
    }
  });
});
