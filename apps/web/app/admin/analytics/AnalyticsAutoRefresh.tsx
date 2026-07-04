"use client";

import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AnalyticsAutoRefresh() {
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
    <span className="inline-flex items-center gap-2 whitespace-nowrap px-2 text-[10px] text-[#6f806f]">
      <i className={`h-1.5 w-1.5 rounded-full bg-emerald-400 ${isRefreshing ? "animate-ping" : "animate-pulse"}`} />
      {isRefreshing ? "Updating" : "Live · 30s"}
    </span>
  );
}
