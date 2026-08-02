function num(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) ? v : fallback;
}

export const brainConfig = {
  get vaultRoot(): string {
    return process.env.BRAIN_VAULT_ROOT ?? "";
  },
  get indexPath(): string {
    return process.env.BRAIN_INDEX_PATH ?? "";
  },
  get dataDir(): string {
    return process.env.BRAIN_DATA_DIR ?? "";
  },
  get groqApiKey(): string {
    return process.env.GROQ_API_KEY ?? "";
  },
  get jinaApiKey(): string {
    return process.env.JINA_API_KEY ?? "";
  },
  get chatModel(): string {
    return process.env.GROQ_CHAT_MODEL ?? "llama-3.3-70b-versatile";
  },
  // Answer generation: Claude (Anthropic) is primary, Groq is the fallback.
  // The old Groq-only client had no retry, so rate limits (429s) caused random
  // "she didn't answer" failures. The Anthropic SDK auto-retries 429/5xx with
  // backoff, and Groq stays as the floor if Anthropic is unreachable.
  // Set BRAIN_LLM=groq to force the old behaviour.
  get llmProvider(): "claude" | "groq" {
    return process.env.BRAIN_LLM?.trim().toLowerCase() === "groq" ? "groq" : "claude";
  },
  get anthropicApiKey(): string {
    return process.env.ANTHROPIC_API_KEY ?? "";
  },
  get anthropicChatModel(): string {
    return process.env.BRAIN_ANTHROPIC_MODEL ?? "claude-haiku-4-5";
  },
  // Anthropic requires an explicit output cap; the old Groq path sent none and
  // used the provider default (~8k). Most Chronicles answers are a sentence to a
  // short paragraph, but recap/analysis modes on a broad campaign question can
  // run long, so 4096 keeps them from truncating mid-thought. Output tokens are
  // pay-per-use, so a higher ceiling costs nothing on the common short answers.
  get chatMaxTokens(): number {
    return num("BRAIN_CHAT_MAX_TOKENS", 4096);
  },
  get embedModel(): string {
    return process.env.JINA_EMBED_MODEL ?? "jina-embeddings-v3";
  },
  get topK(): number {
    return num("TOP_K", 7);
  },
  get chatTimeoutMs(): number {
    return num("CHAT_TIMEOUT_MS", 60000);
  },
  get answerReviewEnabled(): boolean {
    return process.env.ANSWER_REVIEW !== "false";
  },
  get dmModeEnabled(): boolean {
    return Boolean(process.env.BRAIN_DM_SHARED_SECRET || process.env.DM_SHARED_SECRET);
  },
  get googleApiKey(): string {
    return process.env.GOOGLE_API_KEY ?? "";
  },
  get rawPullMinChars(): number {
    const v = Number.parseInt(process.env.RAW_PULL_MIN_CHARS ?? "", 10);
    return Number.isFinite(v) ? v : 500;
  },
  get rawPullMinSizeRatio(): number {
    const v = Number.parseFloat(process.env.RAW_PULL_MIN_SIZE_RATIO ?? "");
    return Number.isFinite(v) ? v : 0.5;
  },
  get rawHistoryKeep(): number {
    const v = Number.parseInt(process.env.RAW_HISTORY_KEEP ?? "", 10);
    return Number.isFinite(v) ? v : 10;
  },
};
