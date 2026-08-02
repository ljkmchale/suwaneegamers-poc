import fs from "node:fs/promises";
import path from "node:path";
import { brainConfig } from "./config";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Increment whenever routing or answer-selection semantics change. Otherwise a
// corrected query can keep serving its old seven-day answer after deployment.
// v5: answer generation moved from Groq (llama-3.3-70b) to Claude Haiku 4.5;
// without this bump, up to seven days of cached Groq answers would keep serving.
const QUERY_CACHE_VERSION = "v5";
const EXCLUDED_SOURCE_PATHS = new Set(["log.md"]);

interface CacheEntry {
  answer: string;
  sources: BrainSource[];
  timestamp: number;
  indexMtimeMs: number;
  hits: number;
}

export interface BrainSource {
  title: string;
  path: string;
  heading?: string;
  campaign?: string;
  score?: number;
}

let _cache: Record<string, CacheEntry> | null = null;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function cachePath(): string {
  return path.join(brainConfig.dataDir, "query-cache.json");
}

async function load(): Promise<Record<string, CacheEntry>> {
  if (_cache) return _cache;
  try {
    const raw = await fs.readFile(cachePath(), "utf8");
    _cache = JSON.parse(raw) as Record<string, CacheEntry>;
  } catch {
    _cache = {};
  }
  return _cache;
}

async function flush(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(cachePath()), { recursive: true });
    await fs.writeFile(cachePath(), JSON.stringify(_cache, null, 2), "utf8");
  } catch { /* non-fatal */ }
}

function scheduleSave(): void {
  if (_saveTimer) return;
  _saveTimer = setTimeout(async () => {
    _saveTimer = null;
    await flush();
  }, 2000);
}

function cacheKey(question: string, options: { campaign?: string; visibility?: string }): string {
  const campaign = String(options.campaign ?? "All");
  const visibility = String(options.visibility ?? "players");
  const normalized = String(question).trim().toLowerCase().replace(/\s+/g, " ");
  return `${QUERY_CACHE_VERSION}|${normalized}|${campaign}|${visibility}`;
}

async function indexMtime(): Promise<number> {
  try {
    return (await fs.stat(brainConfig.indexPath)).mtimeMs;
  } catch {
    return 0;
  }
}

function filterSources(sources: BrainSource[]): BrainSource[] {
  return sources.filter((s) => {
    const p = String(s?.path ?? "").replaceAll(path.sep, "/");
    return !EXCLUDED_SOURCE_PATHS.has(p);
  });
}

export async function lookupCache(
  question: string,
  options: { campaign?: string; visibility?: string } = {},
): Promise<{ answer: string; sources: BrainSource[]; fromCache: true } | null> {
  const cache = await load();
  const key = cacheKey(question, options);
  const entry = cache[key];
  if (!entry) return null;

  if (Date.now() - entry.timestamp > TTL_MS) {
    delete cache[key];
    scheduleSave();
    return null;
  }

  const mtime = await indexMtime();
  if (mtime > entry.indexMtimeMs) {
    delete cache[key];
    scheduleSave();
    return null;
  }

  entry.hits = (entry.hits ?? 0) + 1;
  scheduleSave();
  return { answer: entry.answer, sources: filterSources(entry.sources), fromCache: true };
}

export async function storeCache(
  question: string,
  options: { campaign?: string; visibility?: string },
  result: { answer: string; sources: BrainSource[] },
): Promise<void> {
  const cache = await load();
  const key = cacheKey(question, options);
  cache[key] = {
    answer: result.answer,
    sources: filterSources(result.sources),
    timestamp: Date.now(),
    indexMtimeMs: await indexMtime(),
    hits: 0,
  };
  scheduleSave();
}

export async function clearCache(): Promise<void> {
  _cache = {};
  await flush();
}

export async function cacheStats(): Promise<{ total: number; totalHits: number }> {
  const cache = await load();
  const entries = Object.values(cache);
  return {
    total: entries.length,
    totalHits: entries.reduce((sum, e) => sum + (e.hits ?? 0), 0),
  };
}
