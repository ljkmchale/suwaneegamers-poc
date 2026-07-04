"use client";

import { useFormStatus } from "react-dom";

export function RefreshButton({ label = "Refresh content now" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] hover:text-[#8b5cf6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Running…" : label}
    </button>
  );
}
