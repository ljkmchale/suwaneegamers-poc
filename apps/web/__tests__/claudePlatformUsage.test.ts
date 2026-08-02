import { describe, expect, it } from "vitest";
import { aggregateClaudePlatformUsage } from "@/lib/voiceMetrics";

describe("Claude Platform usage aggregation", () => {
  it("combines daily buckets and both cache creation durations by model", () => {
    const rows = aggregateClaudePlatformUsage([
      { model: "claude-haiku-4-5", uncached_input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 20, cache_creation: { ephemeral_5m_input_tokens: 3, ephemeral_1h_input_tokens: 4 } },
      { model: "claude-haiku-4-5", uncached_input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 10, cache_creation: { ephemeral_5m_input_tokens: 2 } },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ inputTokens: 15, outputTokens: 3, cacheReadTokens: 30, cacheCreationTokens: 9 });
  });
});
