"use client";

import { useState, useTransition } from "react";
import { addPageScheduleAction } from "./actions";

interface Props {
  pagePath: string;
  pageLabel: string;
  defaultLabel?: string;
  triggerLabel?: string;
  sourceJobId?: string;
}

export function AddScheduleForm({ pagePath, pageLabel, defaultLabel, triggerLabel, sourceJobId }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("daily");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await addPageScheduleAction(formData);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="font-cinzel text-[10px] uppercase tracking-widest text-[#9080a0] hover:text-[#8b5cf6] transition-colors"
      >
        {triggerLabel ?? "+ Add schedule"}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 rounded border border-[#2a2a35] bg-[#08050f] p-3">
      <input type="hidden" name="pagePath" value={pagePath} />
      <input type="hidden" name="pageLabel" value={pageLabel} />
      {sourceJobId && <input type="hidden" name="sourceJobId" value={sourceJobId} />}
      <div className="mb-2">
        <label className="block font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] mb-1">
          Label
        </label>
        <input
          type="text"
          name="label"
          defaultValue={defaultLabel ?? ""}
          placeholder="e.g. Campaign Setting"
          required
          className="w-full rounded border border-[#2a2a35] bg-[#0f0a1a] px-2 py-1.5 text-xs text-[#e8dfc8] placeholder-[#3a3040] focus:border-[#8b5cf6] focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] mb-1">
            Type
          </label>
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded border border-[#2a2a35] bg-[#0f0a1a] px-2 py-1.5 text-xs text-[#e8dfc8] focus:border-[#8b5cf6] focus:outline-none"
          >
            <option value="daily">Daily at time</option>
            <option value="interval">Every N hours</option>
            <option value="times">Specific times</option>
          </select>
        </div>

        {kind === "daily" && (
          <div>
            <label className="block font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] mb-1">
              Time
            </label>
            <input
              type="time"
              name="time"
              defaultValue="10:00"
              className="rounded border border-[#2a2a35] bg-[#0f0a1a] px-2 py-1.5 text-xs text-[#e8dfc8] focus:border-[#8b5cf6] focus:outline-none"
              required
            />
          </div>
        )}

        {kind === "interval" && (
          <div>
            <label className="block font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] mb-1">
              Every (hours)
            </label>
            <input
              type="number"
              name="hours"
              min={1}
              max={168}
              defaultValue={6}
              className="w-20 rounded border border-[#2a2a35] bg-[#0f0a1a] px-2 py-1.5 text-xs text-[#e8dfc8] focus:border-[#8b5cf6] focus:outline-none"
              required
            />
          </div>
        )}

        {kind === "times" && (
          <div>
            <label className="block font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] mb-1">
              Times (comma-separated)
            </label>
            <input
              type="text"
              name="times"
              placeholder="08:00, 14:00, 20:00"
              className="w-52 rounded border border-[#2a2a35] bg-[#0f0a1a] px-2 py-1.5 text-xs text-[#e8dfc8] placeholder-[#3a3040] focus:border-[#8b5cf6] focus:outline-none"
              required
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-[#2a2a35] px-3 py-1.5 font-cinzel text-[10px] uppercase tracking-widest text-[#a89880] hover:border-[#8b5cf6] hover:text-[#e8dfc8] transition-colors disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] hover:text-[#ef4444] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
