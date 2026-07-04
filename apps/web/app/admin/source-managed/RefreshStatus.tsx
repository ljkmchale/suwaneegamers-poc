"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  status?: string;
  path?: string;
  message?: string;
}

export function RefreshStatus({ status, path, message }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (status) {
      router.replace("/admin/source-managed");
    }
  }, [status, router]);

  if (!message) return null;

  const failed = status === "refresh-failed";
  return (
    <div
      className={`mb-6 rounded-lg border p-4 text-sm ${
        failed
          ? "border-[#7f1d1d] bg-[#2a0f12] text-[#fecaca]"
          : "border-[#315c3d] bg-[#0f2117] text-[#bbf7d0]"
      }`}
    >
      <p className="font-cinzel text-[10px] uppercase tracking-widest">
        {failed ? "Refresh Failed" : "Refresh Complete"}
      </p>
      <p className="mt-1">
        {path && <span className="mr-2 font-mono text-xs opacity-80">{path}</span>}
        {message}
      </p>
    </div>
  );
}
