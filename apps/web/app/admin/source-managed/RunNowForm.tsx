"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { refreshJobAction } from "./actions";

const initialState = { ok: true, message: "" };

export function RunNowForm({
  jobId,
  label = "Run now",
}: {
  jobId: string;
  label?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(refreshJobAction, initialState);

  useEffect(() => {
    if (!pending && state.message) {
      router.refresh();
    }
  }, [pending, state, router]);

  return (
    <div className="flex items-center gap-3">
      <form action={formAction}>
        <input type="hidden" name="jobId" value={jobId} />
        <button
          type="submit"
          disabled={pending}
          className="font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] hover:text-[#8b5cf6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Running…" : label}
        </button>
      </form>
      {!pending && state.message && (
        <span className={`text-[10px] ${state.ok ? "text-[#bbf7d0]" : "text-[#fecaca]"}`}>
          {state.ok ? "✓" : "✗"} {state.message}
        </span>
      )}
    </div>
  );
}
