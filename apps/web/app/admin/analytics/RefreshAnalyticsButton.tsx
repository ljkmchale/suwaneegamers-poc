"use client";

import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshAnalyticsButton() {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={isRefreshing}
        onClick={refresh}
        className="inline-flex items-center gap-2 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-4 py-2.5 font-cinzel text-[10px] uppercase tracking-widest text-[#a89880] transition-colors hover:border-[#8b5cf6] hover:text-[#e8dfc8] disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} aria-hidden="true" />
        {isRefreshing ? "Refreshing" : "Refresh latest"}
      </button>
      <span className="pl-1 text-[9px] text-[#5a5060]">
        Auto-refreshes every 30 seconds
      </span>
    </div>
  );
}
