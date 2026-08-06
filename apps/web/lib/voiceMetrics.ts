// Not marked "server-only": also imported by the standalone autotuner script
// (scripts/autotune-assistant.ts) run outside Next via tsx.
import { getDb } from "@/lib/db";
import type { TuningSignals } from "@/lib/assistantTuning";
import { estimateClaudeCostMicrousd } from "@/lib/claudeCost";
import { pruneExpired } from "@/lib/retention";

// Phase 0 latency instrumentation added `stt` (recognition time, labelled by
// engine so Parakeet and the Whisper fallback are distinguishable),
// `transcription_delay` and `turn_completed_delay` (the EOU event split into its
// real parts), and `response_latency` (end-to-end felt gap: user stops speaking
// → Myra's first audio). The autotuner still reasons only over the original four.
const METRIC_KINDS = [
  "llm_ttft",
  "eou_delay",
  "tts_ttfb",
  "interruption",
  "stt",
  "transcription_delay",
  "turn_completed_delay",
  "response_latency",
] as const;
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

interface AnthropicUsageResult {
  uncached_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
  cache_read_input_tokens?: number;
  output_tokens?: number;
  model?: string;
}

interface AnthropicUsageResponse {
  data?: Array<{ results?: AnthropicUsageResult[] }>;
  has_more?: boolean;
  next_page?: string | null;
}

export function aggregateClaudePlatformUsage(results: AnthropicUsageResult[]) {
  const byModel = new Map<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  }>();
  for (const result of results) {
    const model = result.model || "unknown";
    const current = byModel.get(model) ?? {
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
    };
    current.inputTokens += Math.max(0, result.uncached_input_tokens ?? 0);
    current.outputTokens += Math.max(0, result.output_tokens ?? 0);
    current.cacheReadTokens += Math.max(0, result.cache_read_input_tokens ?? 0);
    current.cacheCreationTokens += Math.max(
      0,
      (result.cache_creation?.ephemeral_5m_input_tokens ?? 0) +
        (result.cache_creation?.ephemeral_1h_input_tokens ?? 0),
    );
    byModel.set(model, current);
  }
  return [...byModel.entries()].map(([model, usage]) => ({
    model,
    ...usage,
    estimatedCostUsd:
      (estimateClaudeCostMicrousd(model, {
        ...usage,
        inputTokens: usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens,
      }) ?? 0) / 1_000_000,
  }));
}

export async function getClaudePlatformUsage(days: number) {
  const local = getClaudeUsage(days);
  const adminKey = process.env.ANTHROPIC_ADMIN_API_KEY;
  const apiKeyId = process.env.MYRA_ANTHROPIC_API_KEY_ID;
  if (!adminKey || !apiKeyId) {
    return {
      ...local,
      source: "local" as const,
      configured: false,
      message: "Add an Anthropic Admin API key and Myra API-key ID to use Claude Platform usage.",
    };
  }

  const startingAt = new Date(Date.now() - (days - 1) * 86_400_000);
  startingAt.setUTCHours(0, 0, 0, 0);
  const allResults: AnthropicUsageResult[] = [];
  let page: string | null = null;
  try {
    do {
      const query = new URLSearchParams({
        starting_at: startingAt.toISOString(),
        bucket_width: "1d",
        limit: "31",
      });
      query.append("api_key_ids[]", apiKeyId);
      query.append("group_by[]", "model");
      if (page) query.set("page", page);
      const response = await fetch(
        `https://api.anthropic.com/v1/organizations/usage_report/messages?${query}`,
        {
          headers: {
            "x-api-key": adminKey,
            "anthropic-version": "2023-06-01",
          },
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error(`Claude Platform returned HTTP ${response.status}`);
      const payload = await response.json() as AnthropicUsageResponse;
      for (const bucket of payload.data ?? []) allResults.push(...(bucket.results ?? []));
      page = payload.has_more ? payload.next_page ?? null : null;
    } while (page);

    const models = aggregateClaudePlatformUsage(allResults).map((model) => ({
      ...model,
      requests: local.models.find((row) => row.model === model.model)?.requests ?? 0,
    }));
    const summary = models.reduce(
      (total, model) => ({
        requests: local.summary.requests,
        inputTokens: total.inputTokens + model.inputTokens,
        outputTokens: total.outputTokens + model.outputTokens,
        cacheReadTokens: total.cacheReadTokens + model.cacheReadTokens,
        cacheCreationTokens: total.cacheCreationTokens + model.cacheCreationTokens,
        estimatedCostUsd: total.estimatedCostUsd + model.estimatedCostUsd,
      }),
      { requests: local.summary.requests, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, estimatedCostUsd: 0 },
    );
    return {
      summary,
      models,
      source: "claude-platform" as const,
      configured: true,
      message: "Token usage is reported by Claude Platform and scoped to Myra's API key.",
    };
  } catch (error) {
    return {
      ...local,
      source: "local" as const,
      configured: true,
      message: error instanceof Error ? `${error.message}; showing local metrics.` : "Claude Platform is unavailable; showing local metrics.",
    };
  }
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
