"use client";

import { censorGuideReviewAction, deleteGuideReviewAction } from "./actions";

export function GuideReviewActions({ id, censored }: { id: string; censored: boolean }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <form action={censorGuideReviewAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="censored" value={censored ? "0" : "1"} />
        <button
          type="submit"
          className="rounded border border-[#2a2a35] px-2.5 py-1 text-[#a89880] transition-colors hover:border-[#8b5cf6] hover:text-[#f59e0b]"
        >
          {censored ? "Restore" : "Censor"}
        </button>
      </form>
      <form
        action={deleteGuideReviewAction}
        onSubmit={(event) => {
          if (!window.confirm("Delete this review permanently? This cannot be undone.")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="rounded border border-red-900/60 px-2.5 py-1 text-red-300 transition-colors hover:border-red-500 hover:text-red-200"
        >
          Delete
        </button>
      </form>
    </div>
  );
}
