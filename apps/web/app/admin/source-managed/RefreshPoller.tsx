"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RefreshPoller({ hasRunning }: { hasRunning: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [hasRunning, router]);

  return null;
}
