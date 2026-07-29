// Not marked "server-only": also imported by the standalone autotuner script
// (scripts/autotune-assistant.ts) run outside Next via tsx.
import { getDb } from "@/lib/db";
import type { TuningSignals } from "@/lib/assistantTuning";

const METRIC_KINDS = ["llm_ttft", "eou_delay", "tts_ttfb", "interruption"] as const;
type MetricKind = (typeof METRIC_KINDS)[number];

// Granular per-turn timing metrics forwarded by the LiveKit agent's
// `metrics_collected` listener. These feed the nightly autotuner.
export function recordVoiceMetric(input: {
  sessionId?: unknown;
  kind: unknown;
  valueMs?: unknown;
  cachedTokens?: unknown;
}) {
  const kind = String(input.kind ?? "");
  if (!METRIC_KINDS.includes(kind as MetricKind)) {
    throw new Error(`Unknown voice metric kind: ${kind}`);
  }
  const sessionId =
    typeof input.sessionId === "string" ? input.sessionId.slice(0, 100) || null : null;
  const valueMs = Number.isFinite(Number(input.valueMs))
    ? Math.min(600_000, Math.max(0, Math.round(Number(input.valueMs))))
    : null;
  const cachedTokens = Number.isFinite(Number(input.cachedTokens))
    ? Math.max(0, Math.round(Number(input.cachedTokens)))
    : null;

  getDb()
    .prepare(
      `INSERT INTO voice_metrics (session_id, kind, value_ms, cached_tokens, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(sessionId, kind, valueMs, cachedTokens, new Date().toISOString());
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

// Aggregate the recent metrics window into the signals the autotuner reasons over.
export function getTuningSignals(days: number): TuningSignals {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const db = getDb();

  const valuesFor = (kind: MetricKind): number[] =>
    (
      db
        .prepare(
          `SELECT value_ms AS v FROM voice_metrics
           WHERE kind = ? AND created_at >= ? AND value_ms IS NOT NULL`,
        )
        .all(kind, since) as { v: number }[]
    ).map((row) => row.v);

  const ttft = valuesFor("llm_ttft");
  const eou = valuesFor("eou_delay");
  const ttsb = valuesFor("tts_ttfb");
  const interruptions = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM voice_metrics WHERE kind = 'interruption' AND created_at >= ?`)
      .get(since) as { n: number }
  ).n;
  return {
    turns: eou.length,
    interruptions,
    llmResponses: ttft.length,
    ttftP50Ms: percentile(ttft, 50),
    ttftP95Ms: percentile(ttft, 95),
    eouDelayP50Ms: percentile(eou, 50),
    ttsTtfbP50Ms: percentile(ttsb, 50),
  };
}
