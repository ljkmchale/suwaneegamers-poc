// Client-safe schedule types and helpers — no fs/db imports.

export type ScheduleSpec =
  | { kind: "daily"; time: string }
  | { kind: "interval"; hours: number }
  | { kind: "times"; times: string[] };

export function formatScheduleSpec(spec: ScheduleSpec | null, fallback: string): string {
  if (!spec) return fallback;
  if (spec.kind === "interval") return `every ${spec.hours}h`;
  if (spec.kind === "times") return spec.times.join(", ");
  return `daily ${spec.time}`;
}

export function computeNextRun(spec: ScheduleSpec, after: Date): Date {
  if (spec.kind === "interval") {
    return new Date(after.getTime() + spec.hours * 60 * 60 * 1000);
  }
  if (spec.kind === "times") {
    const candidates = spec.times.map((time) => {
      const [h, m] = time.split(":").map(Number);
      const next = new Date(after.getFullYear(), after.getMonth(), after.getDate(), h, m, 0, 0);
      if (next <= after) next.setDate(next.getDate() + 1);
      return next;
    });
    return candidates.reduce((a, b) => (a < b ? a : b));
  }
  const [h, m] = spec.time.split(":").map(Number);
  const next = new Date(after.getFullYear(), after.getMonth(), after.getDate(), h, m, 0, 0);
  if (next <= after) next.setDate(next.getDate() + 1);
  return next;
}
