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
