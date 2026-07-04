import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(srcDir, "..");
const vaultRoot = process.env.BRAIN_VAULT_ROOT
  ? path.resolve(process.env.BRAIN_VAULT_ROOT)
  : path.resolve(appRoot, "..");
const processedRoot = path.join(vaultRoot, "processed");

function numberFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function listFromEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export const config = {
  appRoot,
  vaultRoot,
  processedRoot,
  dataDir: process.env.BRAIN_DATA_DIR ? path.resolve(process.env.BRAIN_DATA_DIR) : path.join(appRoot, "data"),
  indexPath: process.env.BRAIN_INDEX_PATH
    ? path.resolve(process.env.BRAIN_INDEX_PATH)
    : path.join(appRoot, "data", "brain-index.json"),
  googleDocSourcesPath: path.join(appRoot, "google-doc-sources.json"),
  googleDocSyncStatePath: path.join(
    process.env.BRAIN_DATA_DIR ? path.resolve(process.env.BRAIN_DATA_DIR) : path.join(appRoot, "data"),
    "google-doc-sync-state.json",
  ),
  publicDir: path.join(appRoot, "public"),
  get port() {
    return numberFromEnv("PORT", 4317);
  },
  get groqApiKey() {
    return process.env.GROQ_API_KEY ?? "";
  },
  get jinaApiKey() {
    return process.env.JINA_API_KEY ?? "";
  },
  get chatModel() {
    return process.env.GROQ_CHAT_MODEL ?? "llama-3.3-70b-versatile";
  },
  get embedModel() {
    return process.env.JINA_EMBED_MODEL ?? "jina-embeddings-v3";
  },
  get answerReviewEnabled() {
    return process.env.ANSWER_REVIEW !== "false";
  },
  get chunkMaxChars() {
    return numberFromEnv("CHUNK_MAX_CHARS", 1800);
  },
  get chunkOverlapChars() {
    return numberFromEnv("CHUNK_OVERLAP_CHARS", 220);
  },
  get topK() {
    return numberFromEnv("TOP_K", 7);
  },
  get dmSharedSecret() {
    return process.env.DM_SHARED_SECRET ?? "";
  },
  get dmModeEnabled() {
    return Boolean(process.env.DM_SHARED_SECRET);
  },
  get chatTimeoutMs() {
    return numberFromEnv("CHAT_TIMEOUT_MS", 60000);
  },
  get rateLimitAsk() {
    return numberFromEnv("RATE_LIMIT_ASK", 5);
  },
  get rateLimitSearch() {
    return numberFromEnv("RATE_LIMIT_SEARCH", 20);
  },
  get autoPullGoogleDocs() {
    return process.env.AUTO_PULL_GOOGLE_DOCS !== "false";
  },
  get autoPullGoogleDocsIntervalHours() {
    return numberFromEnv("AUTO_PULL_GOOGLE_DOCS_INTERVAL_HOURS", 24);
  },
  get autoPullGoogleDocsStartupDelayMs() {
    return numberFromEnv("AUTO_PULL_GOOGLE_DOCS_STARTUP_DELAY_MS", 30000);
  },
  get autoProcessRawSources() {
    return process.env.AUTO_PROCESS_RAW_SOURCES !== "false";
  },
  get autoIndexAfterSourceProcess() {
    return process.env.AUTO_INDEX_AFTER_SOURCE_PROCESS !== "false";
  },
  get rawHistoryKeep() {
    return numberFromEnv("RAW_HISTORY_KEEP", 10);
  },
  get rawPullMinChars() {
    return numberFromEnv("RAW_PULL_MIN_CHARS", 500);
  },
  get rawPullMinSizeRatio() {
    const value = Number.parseFloat(process.env.RAW_PULL_MIN_SIZE_RATIO ?? "");
    return Number.isFinite(value) ? value : 0.5;
  },
  get googleApiKey() {
    return process.env.GOOGLE_API_KEY ?? "";
  }
};
