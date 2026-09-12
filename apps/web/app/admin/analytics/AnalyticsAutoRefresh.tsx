"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
export function AnalyticsAutoRefresh({ live = false }: { live?: boolean }) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [paused, setPaused] = useState(false);
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  useEffect(() => {
    if (!live || paused) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")) refresh();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [refresh, live, paused]);
  return <div className="flex items-center gap-3 text-xs text-[#baacc8]">
    <button type="button" onClick={refresh} disabled={isRefreshing} className="rounded border border-[#493957] px-3 py-2 disabled:opacity-50">{isRefreshing ? "Refreshing…" : "Refresh"}</button>
    {live && <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused} className="rounded px-2 py-2 text-emerald-300">{paused ? "Resume live updates" : "Pause live · 30s"}</button>}
  </div>;
}
