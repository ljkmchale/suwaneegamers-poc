"use client";

import { useState, useTransition } from "react";
import { updateJobScheduleAction } from "./actions";
import { formatScheduleSpec, type ScheduleSpec } from "@/lib/scheduleSpec";

interface Props {
  jobId: string;
  scheduleSpec: ScheduleSpec | null;
  scheduleFallback: string;
}

export function ScheduleEditor({ jobId, scheduleSpec, scheduleFallback }: Props) {
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<string>(scheduleSpec?.kind ?? "daily");
  const [isPending, startTransition] = useTransition();

  const displaySchedule = formatScheduleSpec(scheduleSpec, scheduleFallback);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateJobScheduleAction(formData);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-[#9080a0]">{displaySchedule}</span>
        <button
          onClick={() => setEditing(true)}
          className="font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] hover:text-[#8b5cf6] transition-colors"
        >
          Edit
        </button>
      </span>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] mb-1">
            Type
          </label>
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded border border-[#2a2a35] bg-[#08050f] px-2 py-1.5 text-xs text-[#e8dfc8] focus:border-[#8b5cf6] focus:outline-none"
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
              defaultValue={scheduleSpec?.kind === "daily" ? scheduleSpec.time : "10:00"}
              className="rounded border border-[#2a2a35] bg-[#08050f] px-2 py-1.5 text-xs text-[#e8dfc8] focus:border-[#8b5cf6] focus:outline-none"
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
              defaultValue={scheduleSpec?.kind === "interval" ? scheduleSpec.hours : 6}
              className="w-20 rounded border border-[#2a2a35] bg-[#08050f] px-2 py-1.5 text-xs text-[#e8dfc8] focus:border-[#8b5cf6] focus:outline-none"
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
              defaultValue={
                scheduleSpec?.kind === "times" ? scheduleSpec.times.join(", ") : ""
              }
              placeholder="08:00, 14:00, 20:00"
              className="w-52 rounded border border-[#2a2a35] bg-[#08050f] px-2 py-1.5 text-xs text-[#e8dfc8] placeholder-[#3a3040] focus:border-[#8b5cf6] focus:outline-none"
              required
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-[#2a2a35] px-3 py-1.5 font-cinzel text-[10px] uppercase tracking-widest text-[#a89880] hover:border-[#8b5cf6] hover:text-[#e8dfc8] transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] hover:text-[#ef4444] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
