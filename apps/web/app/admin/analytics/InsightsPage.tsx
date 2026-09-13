import Link from "next/link";
import { getLiveAnalytics } from "@/lib/liveAnalytics";
import { LiveVisitors } from "./LiveVisitors";
import { getAnalyticsDashboardData, getUsagePurposeMetrics, getVisitorGrowthSummary } from "@/lib/analytics";
import { analyticsAudience, analyticsPeriod, AUDIENCE_LABELS } from "@/lib/analyticsFilters";
import { getMapInsights } from "@/lib/mapInsights";
import { ReportTable, type Column, type ReportRow } from "./ReportTable";
import { TrafficChart } from "./TrafficChart";
import { AnalyticsAutoRefresh } from "./AnalyticsAutoRefresh";

export const INSIGHT_VIEWS = {
  overview: "Overview", audience: "Audience & Acquisition", content: "Content & Journeys",
  maps: "Maps of Myrdae", live: "Live Activity", operations: "Site Performance & Jobs",
} as const;
export type InsightView = keyof typeof INSIGHT_VIEWS;
export type InsightParams = { days?: string; audience?: string; visitor?: string; page?: string; visit?: string; view?: string };
const c = (key: string, label: string, format?: Column["format"], hrefKey?: string): Column => ({ key, label, format, hrefKey });
const n = (key: string, label: string) => c(key, label, "number");
const dt = (key: string, label: string) => c(key, label, "date");
const sec = (key: string, label: string) => c(key, label, "seconds");
const panel = "rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5";

function Cards({ items }: { items: Array<[string, number | string, string]> }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map(([label, value, detail]) => <div key={label} className={panel}>
    <p className="text-xs text-[#baacc8]">{label}</p><p className="mt-2 font-cinzel text-3xl text-[#e8dfc8]">{typeof value === "number" ? value.toLocaleString("en-US") : value}</p><p className="mt-2 text-xs leading-5 text-[#a89880]">{detail}</p>
  </div>)}</div>;
}
function RankedBars({ title, rows, unit }: { title: string; rows: Array<{ label: string; value: number }>; unit: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <section className={panel}><h2 className="font-cinzel text-sm tracking-wider">{title}</h2><div className="mt-5 space-y-4">{rows.map((row, i) => <div key={`${row.label}-${i}`}>
    <div className="mb-2 flex justify-between gap-4 text-xs"><span className="min-w-0 break-words text-[#c8bda8]">{row.label}</span><span className="shrink-0 tabular-nums text-[#e8dfc8]">{row.value.toLocaleString("en-US")} {unit}</span></div>
    <div className="h-2 rounded-full bg-[#241b30]"><div className="h-2 rounded-full bg-[#a78bfa]" style={{ width: `${row.value / max * 100}%` }} /></div>
  </div>)}{!rows.length && <p className="text-sm text-[#a89880]">No recorded activity for this selection.</p>}</div></section>;
}

export async function InsightsPage({ view = "overview", searchParams }: { view?: InsightView; searchParams?: Promise<InsightParams> }) {
  const params = await searchParams ?? {};
  const audience = analyticsAudience(params.audience);
  const { days, since } = analyticsPeriod(Number(params.days ?? 30));
  const data = getAnalyticsDashboardData(days, audience, true);
  const growth = view === "overview" || view === "audience" ? getVisitorGrowthSummary(days, audience) : null;
  const map = view === "maps" || view === "overview" ? getMapInsights(days, audience, params.visit) : null;
  const href = (destination: InsightView, extra: Record<string, string> = {}) => `/admin/analytics${destination === "overview" ? "" : `/${destination}`}?${new URLSearchParams({ days: String(days), audience, ...extra })}`;
  const table = (title: string, columns: Column[], rows: ReportRow[], description?: string) => <ReportTable title={title} columns={columns} rows={rows} description={description} />;
  return <div className="mx-auto max-w-[90rem] space-y-6">
    <header><p className="mb-2 text-xs uppercase tracking-[0.2em] text-violet-300">Site Insights</p><h1 className="font-cinzel text-2xl tracking-wider sm:text-3xl">{INSIGHT_VIEWS[view]}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#a89880]">{view === "overview" ? "See what is being used, understand your audience, and follow the details that need attention." : view === "maps" ? "Follow how people arrive, which locations they open, and where they go next." : view === "operations" ? "Page experience and scheduled content health, with the controls to investigate." : "Explore recorded activity with the same period and audience across reports."}</p></header>
    <div className={`${panel} space-y-4`}>
      <form className="flex flex-wrap items-end gap-4" action={href(view).split("?")[0]}>
        <label className="text-xs text-[#baacc8]">Period<select name="days" defaultValue={days} className="mt-1 block rounded border border-[#493957] bg-[#08050f] px-3 py-2 text-sm text-[#e8dfc8]">{[7, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
        <label className="text-xs text-[#baacc8]">Audience<select name="audience" defaultValue={audience} className="mt-1 block max-w-full rounded border border-[#493957] bg-[#08050f] px-3 py-2 text-sm text-[#e8dfc8]">{Object.entries(AUDIENCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <button className="rounded bg-[#7c3aed] px-4 py-2 text-sm text-white hover:bg-[#6d28d9]">Apply filters</button><AnalyticsAutoRefresh live={false} />
      </form>
      <p className="text-xs leading-5 text-[#a89880]">{AUDIENCE_LABELS[audience]} · {since.toLocaleDateString("en-US")}–{new Date().toLocaleDateString("en-US")} · Daily buckets: {Intl.DateTimeFormat().resolvedOptions().timeZone} · Timestamps: Eastern Time · Updated {new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} ET. {view === "live" && "Live presence uses the last two minutes, independent of the period."}</p>
      <nav aria-label="Analytics reports" className="flex flex-wrap gap-2 border-t border-[#2a2a35] pt-4">{Object.entries(INSIGHT_VIEWS).map(([key, label]) => <Link key={key} href={href(key as InsightView)} aria-current={view === key ? "page" : undefined} className={`rounded-md px-3 py-2 text-xs transition-colors ${view === key ? "bg-[#2b1944] text-violet-200 ring-1 ring-violet-500/50" : "text-[#c8bda8] hover:bg-[#21152e] hover:text-amber-300"}`}>{label}</Link>)}</nav>
    </div>
    {(view === "overview" || view === "live") && <LiveVisitors key={audience} initial={getLiveAnalytics(audience)} audience={audience} days={days} compact={view === "overview"} />}
    {view === "overview" && <>
      <Cards items={[["Recorded visitors", data.summary.uniqueVisitors, "Distinct member or browser identities"], ["First seen in this period", growth?.newVisitorCount ?? 0, "Based on retained analytics history"], ["Visits", data.summary.visits, "Separate visits after 30 minutes of inactivity"], ["Engaged minutes", data.summary.engagedMinutes, "Recorded page engagement across visits"]]} />
      <TrafficChart rows={data.daily} />
      <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-xl border border-[#60412c] bg-gradient-to-br from-[#241527] to-[#0f0a1a] p-6"><p className="text-xs uppercase tracking-widest text-amber-300">Maps of Myrdae</p><h2 className="mt-3 font-cinzel text-2xl">{data.mapActivity.visitors} recorded visitors</h2><p className="mt-3 text-sm leading-6 text-[#c8bda8]">{data.mapActivity.pageViews} page views · {map?.totals.visits ?? 0} visits · {map?.totals.interactingVisits ?? 0} visits with recorded location selections.</p><p className="mt-2 text-xs leading-5 text-[#a89880]">{map?.coverage.firstReceived ? "Location signals have been received. Open the report to inspect collection dates and visit details." : "No location signals have been received yet. Page traffic alone does not reveal activity inside the map."}</p><Link href={href("maps")} className="mt-5 inline-block text-sm text-amber-300 underline underline-offset-4">Investigate map activity →</Link></section>
        <section className={panel}><h2 className="font-cinzel text-sm tracking-wider">Needs attention</h2><ul className="mt-4 space-y-4 text-sm text-[#c8bda8]"><li><Link href={href("operations")} className="hover:text-amber-300">{data.syncJobs.filter((job) => job.status === "failed").length} failed content jobs · {data.summary.clientErrors} browser errors · {data.summary.slowLoads} slow loads →</Link></li><li><Link href={href("live")} className="hover:text-amber-300">{data.summary.activeNow} visitors active in the last two minutes →</Link></li><li><Link href="/admin/voice-assistant" className="text-violet-300">Review Myra usage, cost, and answer quality →</Link></li><li><Link href="/admin/security" className="text-violet-300">Review security incidents and sign-in audit →</Link></li></ul></section></div>
      <div className="grid gap-6 lg:grid-cols-2"><RankedBars title="Most visited pages · top 5" unit="visitors" rows={[...data.topPages].sort((a,b) => b.visitors-a.visitors).slice(0,5).map((p) => ({ label:p.path,value:p.visitors }))} /><RankedBars title="Visit acquisition · top 5" unit="visits" rows={data.referrers.slice(0,5).map((r) => ({label:r.label,value:r.value}))} /></div>
    </>}
    {view === "audience" && <>
      <Cards items={[["Recorded visitors", data.summary.uniqueVisitors, "People may use multiple unidentified browsers"], ["First seen in period", growth?.newVisitorCount ?? 0, "Retained history, not membership join dates"], ["Visits", data.summary.visits, "Visits with recorded activity in this period"], ["Page views", data.summary.pageViews, "Repeated views are included"]]} />
      <TrafficChart rows={data.daily} />
      <div className="grid gap-6 xl:grid-cols-2">{table("Visit acquisition", [c("label", "Source"), n("value", "Visits")], data.referrers, "Source captured for each visit, preferring campaign tags. Unknown/direct includes shared links or missing attribution; Google sign-in is a legacy gap.")}
      {table("First recorded acquisition", [c("source", "Source"), n("count", "Visitors")], growth?.acquisitionBreakdown ?? [], "Only visitors first seen in retained history during this period. This cohort differs from all visits.")}</div>
      <div className="grid gap-6 xl:grid-cols-2">{table("Audience mix", [c("segment", "Audience"), n("visitors", "Visitors"), n("sessions", "Visits"), n("pageViews", "Views"), sec("engagedSeconds", "Engaged")], data.visitorSegments)}
      {table("Devices", [c("label", "Device"), n("value", "Visits"), c("share", "Share", "percent")], data.devices.map((r) => ({...r, share: Math.round(r.value / Math.max(1,data.devices.reduce((sum,row) => sum+row.value,0))*100)})), "Devices are counted per visit, not per person.")}</div>
      {table("Visitors", [c("name", "Visitor", undefined, "href"), c("email", "Email"), c("deviceMix", "Devices"), dt("lastSeenAt", "Last seen"), n("sessions", "Visits"), n("pageViews", "Views"), sec("engagedSeconds", "Engaged"), n("pagesViewed", "Pages"), c("topPage", "Most viewed page"), c("history", "History")], data.people.map((p) => ({...p, deviceMix:p.deviceMix.join(", "), signedIn:p.signedIn ? "Member":"Unidentified", firstTimeVisitor:undefined, history:p.firstTimeVisitor ? "One retained visit":"Multiple retained visits", href:href("audience", {visitor:p.visitorToken})})), "Select a visitor to see their pages. Member join dates and roster status remain in Members.")}
      {params.visitor && <div className="space-y-3"><div className="flex justify-between gap-4"><h2 className="font-cinzel">{data.people.find((p)=>p.visitorToken===params.visitor)?.name ?? "Visitor not in this selection"}</h2><Link href={href("audience")} className="text-sm text-violet-300">Clear visitor selection</Link></div>{table("Visitor page activity", [c("pageLabel","Page",undefined,"href"),n("pageViews","Views"),sec("engagedSeconds","Engaged"),dt("firstViewedAt","First activity"),dt("lastViewedAt","Last activity")], data.memberPageActivity.filter((r)=>r.visitorToken===params.visitor).map((r) => ({...r,signedIn:undefined,href:href("content",{page:r.path})})))}</div>}
      {table("Recent visits", [c("visitorLabel","Visitor"),dt("lastSeenAt","Last seen"),c("entryPath","Entry"),c("acquisitionSource","Source"),c("acquisitionCampaign","Campaign"),c("lastPath","Last page"),c("deviceType","Device"),n("pageViews","Visit views"),sec("engagedSeconds","Visit engagement")], data.recentVisitors.map((r)=>({...r,firstTimeVisitor:undefined})), "One row per visit. Visit totals include the whole visit; page reports count events inside the selected period.")}
      <Link href="/admin/members" className="text-violet-300 underline">Open Members for join dates and roster status →</Link>
    </>}
    {view === "content" && <>
      <Cards items={[["Page views",data.summary.pageViews,"Recorded page openings"],["Media plays",data.summary.mediaPlays,"Plays, with milestones in media details"],["Action clicks",data.summary.actionClicks,"Excludes navigation, footer, and utility clicks"],["Searches",data.summary.searches,"Recorded search submissions"]]} />
      {table("Pages",[c("pageLabel","Page",undefined,"href"),n("pageViews","Views"),n("people","Visitors"),dt("lastViewedAt","Last activity")],data.pageAudiences.map((p)=>({...p,visitorNames:p.visitorNames.join(", "),href:href("content",{page:p.path})})),"Select a page to inspect its audience. All recorded pages are available through pagination.")}
      {params.page && <div className="space-y-3"><div className="flex justify-between gap-4"><h2 className="font-cinzel">{data.pageAudiences.find((p)=>p.path===params.page)?.pageLabel ?? params.page}</h2><Link href={href("content")} className="text-sm text-violet-300">Clear page selection</Link></div>{table("Page audience",[c("name","Visitor",undefined,"href"),n("pageViews","Views"),sec("engagedSeconds","Engaged"),dt("firstViewedAt","First activity"),dt("lastViewedAt","Last activity")],data.memberPageActivity.filter((r)=>r.path===params.page).map((r)=>({...r,signedIn:undefined,href:href("audience",{visitor:r.visitorToken})})))}</div>}
      <details className={panel}><summary className="cursor-pointer font-cinzel text-sm text-violet-200">Reading, media & campaigns</summary><div className="mt-5 space-y-6">
        {table("Page engagement",[c("path","Page"),n("pageViews","Views"),n("visitors","Visitors"),sec("engagedSeconds","Engaged")],data.topPages)}
        {table("Content opens",[c("label","Content"),c("type","Type"),n("views","Opens")],data.topContent)}
        {table("Media",[c("label","Recording"),n("plays","Plays"),n("progress25","25% events"),n("progress50","50% events"),n("progress75","75% events"),n("completions","Completed")],data.topMedia,"Milestones are recorded events, not a unique-listener conversion funnel.")}
        {table("Campaign engagement",[c("campaign","Campaign"),n("pageViews","Views"),n("visitors","Visitors"),sec("engagedSeconds","Engaged"),n("sessionOpens","Summary opens"),n("mediaPlays","Plays")],data.campaignEngagement)}
        {table("Session interest",[c("label","Session"),n("opens","Opens"),n("mediaPlays","Plays")],data.sessionEngagement,"Opens and plays are shown separately rather than added into an interest score.")}
      </div></details>
      <details className={panel}><summary className="cursor-pointer font-cinzel text-sm text-violet-200">Searches & actions</summary><div className="mt-5 space-y-6">
        {table("Clicked actions",[c("label","Action"),c("href","Target"),c("type","Type"),n("clicks","Clicks")],data.topClicks)}
        {table("Click types",[c("type","Type"),n("clicks","Clicks")],data.clickTypes)}
        {table("Search terms",[c("query","Search"),n("searches","Searches"),n("resultClicks","Result clicks")],data.searchTerms)}
        {table("Search gaps",[c("query","Search"),n("searches","Searches"),n("resultClicks","Result clicks"),n("noResults","No-result events")],data.searchGaps)}
        {table("Search result choices",[c("query","Search"),c("href","Selected result"),n("clicks","Clicks")],data.searchResultChoices)}
      </div></details>
      <details className={panel}><summary className="cursor-pointer font-cinzel text-sm text-violet-200">Page depth, exits & journeys</summary><div className="mt-5 space-y-6">
        {table("Deepest recorded scroll",[c("pageLabel","Page"),c("maxDepth","Maximum depth","percent"),n("visitors","Visitors"),n("depthEvents","Depth events")],data.pageDepth,"Maximum recorded depth, not the average reader's depth or proof that the content was read.")}
        {table("Exit pages",[c("path","Page"),n("exits","Exit events"),sec("engagedSeconds","Recorded engagement")],data.exitPages)}
        {table("Page journeys",[c("fromPath","From"),c("toPath","To"),n("transitions","Moves")],data.journeyPaths)}
        {table("Inferred activity",[c("purpose","Activity"),n("visits","Distinct visits"),n("signals","Signals"),c("averageConfidence","Average signal confidence","percent")],getUsagePurposeMetrics(days,audience).map((r)=>({...r,purpose:r.purpose.replaceAll("_"," ")})),"Activity inferred from recorded signals, not personal motivation. A visit can have multiple purposes; counts are not additive.")}
      </div></details>
    </>}
    {view === "maps" && map && <>
      <Cards items={[["Map visitors",data.mapActivity.visitors,"Distinct recorded visitors in the selected audience"],["Map visits",map.totals.visits,"Visits with recorded map-page activity"],["Visits with selections",map.totals.interactingVisits,"At least one received location or region selection"],["Location selections",map.totals.clicks ?? 0,"Repeated selections included"]]} />
      <section className="rounded-xl border border-[#60412c] bg-[#211323] p-5"><h2 className="font-cinzel text-sm text-amber-200">Tracking coverage</h2><p className="mt-3 text-sm leading-6 text-[#c8bda8]">{map.coverage.firstReceived ? `First retained location signal: ${new Date(map.coverage.firstReceived).toLocaleString("en-US",{timeZone:"America/New_York"})} ET. Most recent: ${new Date(map.coverage.lastReceived!).toLocaleString("en-US",{timeZone:"America/New_York"})} ET.` : "No location or region signals have reached the database yet. This does not mean visitors have not clicked the map."} Collection dates describe received signals across all audiences. Page views and time on the containing page do not establish interaction inside the map.</p><p className="mt-2 text-xs leading-5 text-[#a89880]">{data.mapActivity.pageViews} page views · {Math.round(data.mapActivity.engagedSeconds/60)} recorded engaged minutes. An interaction rate is withheld until continuous collection coverage is verified. First-seen cohorts use retained history, not membership dates.</p></section>
      <RankedBars title="Locations attracting the most visitors · top 8" unit="visitors" rows={map.locations.slice(0,8).map((r)=>({label:r.label,value:r.visitors}))} />
      {table("Locations & regions",[c("label","Place"),c("kind","Type"),n("visitors","Visitors"),n("visits","Visits"),n("clicks","Selections"),dt("lastSeen","Last selection")],map.locations,"Ranked by distinct visitors, then selections. Places are grouped by stable ID and type.")}
      {table("Map arrivals and next pages",[c("visitor","Visitor",undefined,"href"),dt("openedAt","Map opened"),c("previous","Previous page"),c("next","Next page")],map.journeys.map((row)=>({...row,href:`${href("maps",{visit:row.visitId})}#map-visit-timeline`})),"One row per recorded map opening. Select a visitor to inspect that visit's full timeline. Missing previous or next pages only describe the selected reporting period and are not proof of arrival or abandonment.")}
      {table("Map visits",[c("visitor","Visitor",undefined,"href"),c("cohort","Retained-history cohort"),c("source","Acquisition"),c("campaign","Campaign"),c("entry","Acquisition / entry page"),c("device","Device"),n("views","Map views"),n("clicks","Selections"),sec("engagedSeconds","Engaged"),dt("lastSeen","Last map activity")],map.visits.map((r)=>({...r,href:`${href("maps",{visit:r.id})}#map-visit-timeline`})),"Select a visit to follow its recorded sequence. Use Exclude internal to focus on activity outside known owner/testing traffic.")}
      {params.visit && <div id="map-visit-timeline" className="scroll-mt-6 space-y-3"><div className="flex justify-between gap-3"><h2 className="font-cinzel">{map.selectedVisit?.visitor ?? "Visit not in this selection"}</h2><Link href={href("maps")} className="text-sm text-violet-300">Clear visit selection</Link></div>{table("Visit timeline",[dt("at","Time"),c("path","Page"),c("event","Event"),c("kind","Type"),c("target","Target"),n("value","Recorded value")],map.timeline,"Chronological events inside the period. Values are seconds for engagement, percent for depth, and milliseconds for loads.")}</div>}
    </>}
    {view === "operations" && <>
      <Cards items={[["Slow loads",data.summary.slowLoads,"Recorded loads of at least three seconds"],["Browser errors",data.summary.clientErrors,"Events in the selected audience and period"],["Failed jobs",data.syncJobs.filter((j)=>j.status === "failed").length,"Current global status; independent of audience"],["Successful jobs",data.syncJobs.filter((j)=>j.status === "succeeded").length,"Last run succeeded; current global status"]]} />
      {table("Slow page loads",[c("path","Page"),n("events","Slow events"),c("averageMs","Average slow load","ms"),c("worstMs","Worst load","ms")],data.performanceIssues,"Timings summarize slow-load events, not all page loads.")}
      {table("Browser errors",[c("label","Error"),c("path","Page"),n("count","Events")],data.clientErrors)}
      {table("Scheduled content jobs",[c("label","Job"),c("status","Last status"),dt("lastStartedAt","Started"),dt("lastFinishedAt","Finished"),dt("nextRunAt","Next run"),c("durationMs","Duration","ms")],data.syncJobs,"Current job states are global and independent of visitor filters.")}
      {table("Job run history",[c("label","Job"),dt("startedAt","Started"),c("status","Status"),c("durationMs","Duration","ms"),c("message","Message")],data.recentSyncRuns,"Runs in the selected period, across all audiences.")}
      <Link href="/admin/source-managed" className="inline-block text-violet-300 underline underline-offset-4">Open Source Managed to run jobs or edit schedules →</Link>
    </>}
    <footer className="border-t border-[#2a2a35] pt-5 text-xs leading-6 text-[#a89880]">Reports cover retained first-party analytics (up to 90 days), not all historical traffic. Signed-in identity comes from the server; unidentified browsers can represent the same person. Internal activity means known owner/testing identities and local referrers, not every administrator. No visitor IP addresses are stored in these analytics. <Link href="/admin/members" className="text-violet-300">Members</Link> holds membership dates; <Link href="/admin/security" className="text-violet-300">Security</Link> holds request and sign-in audit details.</footer>
  </div>;
}
