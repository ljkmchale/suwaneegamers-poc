import { describe, expect, it } from "vitest";
import { claudeRates, estimateClaudeCostMicrousd } from "@/lib/claudeCost";

describe("Claude cost accounting", () => {
  it("uses the Haiku 4.5 public rates", () => {
    expect(claudeRates("claude-haiku-4-5")).toEqual({
      input: 1,
      output: 5,
      cacheRead: 0.1,
      cacheCreation: 1.25,
    });
  });

  it("prices uncached, cached, cache-write, and output tokens separately", () => {
    expect(
      estimateClaudeCostMicrousd("claude-haiku-4-5", {
        inputTokens: 10_000,
        outputTokens: 1_000,
        cacheReadTokens: 4_000,
        cacheCreationTokens: 2_000,
      }),
    ).toBe(11_900);
  });

  it("does not invent a price for an unknown future model", () => {
    expect(
      estimateClaudeCostMicrousd("claude-unknown", {
        inputTokens: 1,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      }),
    ).toBeNull();
  });
});
