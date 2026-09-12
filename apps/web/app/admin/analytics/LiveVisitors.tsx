"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { LiveAnalytics } from "@/lib/liveAnalytics";
import type { AnalyticsAudience } from "@/lib/analyticsFilters";
import { ReportTable } from "./ReportTable";

export function LiveVisitors({ initial, audience, days, compact = false }: { initial: LiveAnalytics; audience: AnalyticsAudience; days: number; compact?: boolean }) {
  const [data, setData] = useState(initial);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (paused) return;
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      try {
        const response = await fetch(`/admin/analytics/live-data?audience=${audience}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Live update unavailable");
        const latest = await response.json() as LiveAnalytics;
        if (!controller.signal.aborted) { setData(latest); setError(false); }
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { pending = false; }
    };
    const timer = window.setInterval(refresh, 30_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [audience, paused]);
  return <section aria-label="Who is on the site now" className="space-y-3 rounded-xl border border-emerald-900/70 bg-[#0c1515] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-cinzel text-lg text-[#e8dfc8]">Who is on now <span className="ml-2 text-emerald-300">{data.visitors.length}</span></h2><p className="mt-1 text-xs text-[#b0beb3]">Visitors with a signal in the last two minutes · {paused ? "Updates paused" : "Updates every 30 seconds"} · Last checked {new Date(data.updatedAt).toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit",second:"2-digit"})} ET</p></div>
      <button type="button" aria-pressed={paused} onClick={()=>setPaused(!paused)} className="rounded border border-emerald-800 px-3 py-2 text-xs text-emerald-200">{paused ? "Resume live" : "Pause live"}</button></div>
    {error && <p role="status" className="text-sm text-amber-200">Live refresh is unavailable. Showing the last successful update; refresh the page or sign in again.</p>}
    <ReportTable title="Current visitors" description="Names appear for identified members. Recent signals indicate presence, not proof of active reading." initialSize={compact ? 5 : 15}
      columns={[{key:"visitor",label:"Visitor",hrefKey:"href"},{key:"currentPath",label:"Current page"},{key:"device",label:"Device"},{key:"lastSeen",label:"Last activity",format:"date"},{key:"views",label:"Visit views",format:"number"}]}
      rows={data.visitors.map((r)=>({...r,href:`/admin/analytics/audience?${new URLSearchParams({days:String(days),audience,visitor:r.visitorToken})}`}))} />
    {compact && <Link href={`/admin/analytics/live?days=${days}&audience=${audience}`} className="inline-block text-sm text-emerald-200 underline underline-offset-4">Open full Live Activity →</Link>}
  </section>;
}
