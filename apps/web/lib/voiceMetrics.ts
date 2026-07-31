// Not marked "server-only": also imported by the standalone autotuner script
// (scripts/autotune-assistant.ts) run outside Next via tsx.
import { getDb } from "@/lib/db";
import type { TuningSignals } from "@/lib/assistantTuning";
import { estimateClaudeCostMicrousd } from "@/lib/claudeCost";
import { pruneExpired } from "@/lib/retention";

const METRIC_KINDS = ["llm_ttft", "eou_delay", "tts_ttfb", "interruption"] as const;
type MetricKind = (typeof METRIC_KINDS)[number];

// The autotuner and the cost panel both look back over days, not months.
const RETENTION_DAYS = 90;

function ensureUsageColumns() {
  const db = getDb();
  const columns = new Set(
    (db.prepare(`PRAGMA table_info(voice_metrics)`).all() as { name: string }[]).map(
      (column) => column.name,
    ),
  );
  const required = [
    ["provider", "TEXT"],
    ["model", "TEXT"],
    ["input_tokens", "INTEGER"],
    ["output_tokens", "INTEGER"],
    ["cache_read_tokens", "INTEGER"],
    ["cache_creation_tokens", "INTEGER"],
    ["estimated_cost_microusd", "INTEGER"],
  ] as const;
  for (const [name, type] of required) {
    if (!columns.has(name)) {
      db.exec(`ALTER TABLE voice_metrics ADD COLUMN ${name} ${type}`);
    }
  }
}

// Granular per-turn timing metrics forwarded by the LiveKit agent's
// `metrics_collected` listener. These feed the nightly autotuner.
export function recordVoiceMetric(input: {
  sessionId?: unknown;
  kind: unknown;
  valueMs?: unknown;
  cachedTokens?: unknown;
  provider?: unknown;
  model?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  cacheReadTokens?: unknown;
  cacheCreationTokens?: unknown;
}) {
  ensureUsageColumns();
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
  const clean = (value: unknown, length: number) =>
    typeof value === "string" ? value.trim().slice(0, length) || null : null;
  const tokenCount = (value: unknown) =>
    Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
  const provider = clean(input.provider, 50);
  const model = clean(input.model, 100);
  const inputTokens = tokenCount(input.inputTokens);
  const outputTokens = tokenCount(input.outputTokens);
  const cacheReadTokens = tokenCount(input.cacheReadTokens ?? input.cachedTokens);
  const cacheCreationTokens = tokenCount(input.cacheCreationTokens);
  const estimatedCostMicrousd =
    provider === "anthropic" && model
      ? estimateClaudeCostMicrousd(model, {
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheCreationTokens,
        })
      : 0;

  getDb()
    .prepare(
      `INSERT INTO voice_metrics
        (session_id, kind, value_ms, cached_tokens, provider, model,
         input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
         estimated_cost_microusd, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      sessionId,
      kind,
      valueMs,
      cachedTokens,
      provider,
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      estimatedCostMicrousd,
      new Date().toISOString(),
    );

  pruneExpired([{ table: "voice_metrics", column: "created_at", days: RETENTION_DAYS }]);
}

export function getClaudeUsage(days: number) {
  ensureUsageColumns();
  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const db = getDb();
  const summary = db.prepare(`
    SELECT COUNT(*) AS requests,
      COALESCE(SUM(input_tokens), 0) AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(SUM(cache_creation_tokens), 0) AS cache_creation_tokens,
      COALESCE(SUM(estimated_cost_microusd), 0) AS cost_microusd
    FROM voice_metrics
    WHERE kind = 'llm_ttft' AND provider = 'anthropic' AND created_at >= ?
  `).get(sinceIso) as {
    requests: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    cost_microusd: number;
  };
  const models = db.prepare(`
    SELECT COALESCE(model, 'unknown') AS model, COUNT(*) AS requests,
      COALESCE(SUM(input_tokens), 0) AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(SUM(cache_creation_tokens), 0) AS cache_creation_tokens,
      COALESCE(SUM(estimated_cost_microusd), 0) AS cost_microusd
    FROM voice_metrics
    WHERE kind = 'llm_ttft' AND provider = 'anthropic' AND created_at >= ?
    GROUP BY model ORDER BY cost_microusd DESC
  `).all(sinceIso) as Array<{
    model: string;
    requests: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    cost_microusd: number;
  }>;
  const map = (row: typeof summary | (typeof models)[number]) => ({
    requests: row.requests,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheCreationTokens: row.cache_creation_tokens,
    estimatedCostUsd: row.cost_microusd / 1_000_000,
  });
  return {
    summary: map(summary),
    models: models.map((row) => ({ model: row.model, ...map(row) })),
  };
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
