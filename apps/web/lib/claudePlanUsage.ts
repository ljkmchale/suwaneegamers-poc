import { getDb } from "@/lib/db";

/**
 * How much of the Claude subscription window is spent, as last reported by the
 * voice worker (kind "plan_usage" in voice_metrics; value_ms is percent x 100).
 *
 * The plan is shared by every Claude call on this machine, so one reading from
 * the voice worker describes all of them.
 */
export type PlanUsageReading = {
  fiveHourPercent: number | null;
  sevenDayPercent: number | null;
  /** Newest reading of either window, ISO time. */
  at: string | null;
};

const FRESH_MS = 20 * 60_000;

type Row = { model: string | null; value_ms: number | null; created_at: string };

export function readPlanUsage(now = Date.now()): PlanUsageReading {
  const rows = getDb()
    .prepare(
      `SELECT model, value_ms, created_at FROM voice_metrics
       WHERE kind = 'plan_usage' ORDER BY created_at DESC LIMIT 40`,
    )
    .all() as Row[];
  const latest = new Map<string, Row>();
  for (const row of rows) {
    if (!row.model || row.value_ms == null) continue;
    if (now - Date.parse(row.created_at) > FRESH_MS) continue;
    if (!latest.has(row.model)) latest.set(row.model, row);
  }
  const percent = (key: string) => {
    const row = latest.get(key);
    return row && row.value_ms != null ? Math.round(row.value_ms) / 100 : null;
  };
  const times = [...latest.values()].map((row) => row.created_at).sort();
  return {
    fiveHourPercent: percent("five_hour"),
    sevenDayPercent: percent("seven_day"),
    at: times.length ? times[times.length - 1] : null,
  };
}

export type PlanUsageSummary = {
  status: "healthy" | "degraded" | "unknown";
  message: string;
};

/** Thresholds mirror the voice worker's CLAUDE_PLAN_DEGRADE_PCT / FALLBACK_PCT. */
export function summarizePlanUsage(
  reading: PlanUsageReading,
  degradeAt = 80,
  fallbackAt = 95,
): PlanUsageSummary {
  const { fiveHourPercent: five, sevenDayPercent: seven } = reading;
  if (five == null && seven == null) {
    return {
      status: "unknown",
      message:
        "No plan usage reading yet. One appears after a voice turn runs on the Claude subscription.",
    };
  }
  const describe =
    `5-hour window ${five == null ? "unknown" : `${five}%`} used, ` +
    `weekly ${seven == null ? "unknown" : `${seven}%`} used`;
  const peak = Math.max(five ?? 0, seven ?? 0);
  if (peak >= fallbackAt) {
    return {
      status: "degraded",
      message: `Claude plan nearly exhausted (${describe}). New turns are served by the API key until it resets.`,
    };
  }
  if (peak >= degradeAt) {
    return {
      status: "healthy",
      message: `Claude plan under pressure (${describe}). Voice turns are using the fast model.`,
    };
  }
  return { status: "healthy", message: `Claude plan has headroom (${describe}).` };
}
