"use client";

import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { Users } from "lucide-react";
import type { LiveAnalytics } from "@/lib/liveAnalytics";

export function AdminPresence() {
  const [data, setData] = useState<LiveAnalytics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      try {
        const response = await fetch("/admin/analytics/live-data?audience=all", {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Unavailable");
        const next = await response.json() as LiveAnalytics;
        if (!controller.signal.aborted) { setData(next); setError(false); }
      } catch {
        if (!controller.signal.aborted) { setError(true); setData(null); }
      } finally { pending = false; }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const label = error ? "Online status unavailable" : data ? `${data.visitors.length} visitors online` : "Loading online visitors";
  return <Popover.Root>
    <Popover.Trigger asChild>
      <button aria-label={label} title={label} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-emerald-800 px-2 text-xs text-emerald-200 focus-visible:outline-2 focus-visible:outline-emerald-300">
        <Users size={16} aria-hidden="true" /><span className="hidden xl:inline">Online</span>
        <span className="tabular-nums">{data ? data.visitors.length : error ? "!" : "…"}</span>
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="end" sideOffset={8} className="z-[70] w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-emerald-900 bg-[#0c1515] p-4 text-[#e8dfc8] shadow-2xl">
        <Popover.Label className="font-cinzel text-sm">Who is on now</Popover.Label>
        <p className="mt-1 text-xs text-[#b0beb3]">Activity in the last two minutes, including you. Updates every 30 seconds.</p>
        {error ? <p role="status" className="mt-4 text-xs text-amber-200">Live activity is unavailable. Refresh the page or sign in again.</p>
          : !data ? <p role="status" className="mt-4 text-xs">Loading visitors…</p>
          : <ul className="my-3 max-h-72 space-y-3 overflow-y-auto">
            {data.visitors.map(visitor => <li key={visitor.visitorToken} className="text-sm">
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />{visitor.visitor}</span>
              <span className="mt-0.5 block break-all pl-3.5 text-xs text-[#b0beb3]">{visitor.currentPath}</span>
            </li>)}
            {!data.visitors.length && <li className="text-xs text-[#b0beb3]">No activity in the last two minutes.</li>}
          </ul>}
        <Popover.Item asChild>
          <Link href="/admin/analytics/live" className="mt-3 block rounded text-xs text-emerald-200 underline underline-offset-4 outline-none focus:bg-emerald-950">Open Live Activity</Link>
        </Popover.Item>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
