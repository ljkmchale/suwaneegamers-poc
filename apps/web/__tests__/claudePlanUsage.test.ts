import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { readPlanUsage, summarizePlanUsage } from "@/lib/claudePlanUsage";
import { recordVoiceMetric } from "@/lib/voiceMetrics";

describe("Claude plan usage", () => {
  beforeEach(() => {
    getDb().prepare("DELETE FROM voice_metrics WHERE kind = 'plan_usage'").run();
  });

  it("reads the newest reading per window from recorded metrics", () => {
    recordVoiceMetric({ kind: "plan_usage", valueMs: 2000, model: "five_hour", provider: "claude-code-subscription" });
    recordVoiceMetric({ kind: "plan_usage", valueMs: 3500, model: "five_hour", provider: "claude-code-subscription" });
    recordVoiceMetric({ kind: "plan_usage", valueMs: 600, model: "seven_day", provider: "claude-code-subscription" });
    const reading = readPlanUsage();
    expect(reading.fiveHourPercent).toBe(35);
    expect(reading.sevenDayPercent).toBe(6);
    expect(reading.at).not.toBeNull();
  });

  it("ignores stale readings", () => {
    recordVoiceMetric({ kind: "plan_usage", valueMs: 9000, model: "five_hour" });
    const reading = readPlanUsage(Date.now() + 60 * 60_000);
    expect(reading.fiveHourPercent).toBeNull();
  });

  it("summarizes headroom, pressure, exhaustion and no data", () => {
    const base = { sevenDayPercent: 6, at: null };
    expect(summarizePlanUsage({ ...base, fiveHourPercent: 35 }).status).toBe("healthy");
    const high = summarizePlanUsage({ ...base, fiveHourPercent: 85 });
    expect(high.status).toBe("healthy");
    expect(high.message).toMatch(/fast model/);
    const critical = summarizePlanUsage({ ...base, fiveHourPercent: 97 });
    expect(critical.status).toBe("degraded");
    expect(critical.message).toMatch(/API key/);
    expect(summarizePlanUsage({ fiveHourPercent: null, sevenDayPercent: null, at: null }).status).toBe("unknown");
  });
});
