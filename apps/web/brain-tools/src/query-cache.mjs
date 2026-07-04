import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";

const CACHE_PATH = path.join(config.dataDir, "query-cache.json");
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const queryExcludedSourcePaths = new Set(["log.md"]);

let _cache = null;
let _saveTimer = null;

async function load() {
  if (_cache) return _cache;
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    _cache = JSON.parse(raw);
  } catch {
    _cache = {};
  }
  return _cache;
}

async function flush() {
  try {
    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await fs.writeFile(CACHE_PATH, JSON.stringify(_cache, null, 2), "utf8");
  } catch { /* non-fatal */ }
}

function scheduleSave() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(async () => {
    _saveTimer = null;
    await flush();
  }, 2000);
}

function cacheKey(question, options = {}) {
  const campaign = String(options.campaign ?? "All");
  const visibility = String(options.visibility ?? "players");
  const normalized = String(question).trim().toLowerCase().replace(/\s+/g, " ");
  return `${normalized}|${campaign}|${visibility}`;
}

async function indexMtime() {
  try {
    return (await fs.stat(config.indexPath)).mtimeMs;
  } catch {
    return 0;
  }
}

export async function lookupCache(question, options = {}) {
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
  return { answer: entry.answer, sources: filterQuerySources(entry.sources), fromCache: true };
}

export async function storeCache(question, options = {}, result) {
  const cache = await load();
  const key = cacheKey(question, options);
  cache[key] = {
    answer: result.answer,
    sources: filterQuerySources(result.sources),
    timestamp: Date.now(),
    indexMtimeMs: await indexMtime(),
    hits: 0
  };
  scheduleSave();
}

function filterQuerySources(sources = []) {
  return sources.filter((source) => {
    const sourcePath = String(source?.path ?? "").replaceAll(path.sep, "/");
    return !queryExcludedSourcePaths.has(sourcePath);
  });
}

export async function clearCache() {
  _cache = {};
  await flush();
}

export async function cacheStats() {
  const cache = await load();
  const entries = Object.values(cache);
  return {
    total: entries.length,
    totalHits: entries.reduce((sum, e) => sum + (e.hits ?? 0), 0)
  };
}
