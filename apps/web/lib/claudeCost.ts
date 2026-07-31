export interface ClaudeTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

// USD per million tokens. Myra currently uses Haiku 4.5. The neighboring
// current model families make model changes visible and correctly priced
// instead of silently continuing to use the Haiku rate.
const PRICING: Array<{ matches: RegExp; rates: ModelPricing }> = [
  {
    matches: /haiku-4-5/i,
    rates: { input: 1, output: 5, cacheRead: 0.1, cacheCreation: 1.25 },
  },
  {
    matches: /sonnet-(4-5|4-6)/i,
    rates: { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 },
  },
  {
    matches: /opus-(4-5|4-6|4-7|4-8|5)/i,
    rates: { input: 5, output: 25, cacheRead: 0.5, cacheCreation: 6.25 },
  },
];

export function claudeRates(model: string): ModelPricing | null {
  return PRICING.find((entry) => entry.matches.test(model))?.rates ?? null;
}

export function estimateClaudeCostMicrousd(
  model: string,
  usage: ClaudeTokenUsage,
): number | null {
  const rates = claudeRates(model);
  if (!rates) return null;
  const uncachedInput = Math.max(
    0,
    usage.inputTokens - usage.cacheReadTokens - usage.cacheCreationTokens,
  );
  // A USD-per-million-token rate multiplied by tokens equals micro-USD.
  return Math.round(
    uncachedInput * rates.input +
      usage.outputTokens * rates.output +
      usage.cacheReadTokens * rates.cacheRead +
      usage.cacheCreationTokens * rates.cacheCreation,
  );
}
