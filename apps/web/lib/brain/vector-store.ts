import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { brainConfig } from "./config";

export interface ChunkMetadata {
  path: string;
  title: string;
  campaign: string;
  visibility: string;
  heading: string;
  chunkIndex: number;
  links?: string[];
  tags?: string[];
  browseOnly?: boolean;
}

export interface IndexItem {
  id: string;
  text: string;
  metadata: ChunkMetadata;
  embedding: number[];
  score?: number;
  semanticScore?: number;
  lexicalScore?: number;
  directScore?: number;
}

export interface PageEntry {
  path: string;
  title: string;
  campaign: string;
  visibility: string;
  links: string[];
  backlinks: string[];
}

export interface BrainIndex {
  version: number;
  createdAt: string;
  embedModel: string;
  chunkCount: number;
  fileHashes: Record<string, string>;
  pages: Record<string, PageEntry>;
  items: IndexItem[];
}

let _indexCache: BrainIndex | null = null;
let _indexCacheMtime: number | null = null;

export async function loadIndex(): Promise<BrainIndex> {
  const stat = await fs.stat(brainConfig.indexPath);
  if (_indexCache && _indexCacheMtime === stat.mtimeMs) return _indexCache;
  const raw = await fs.readFile(brainConfig.indexPath, "utf8");
  _indexCache = JSON.parse(raw) as BrainIndex;
  _indexCacheMtime = stat.mtimeMs;
  return _indexCache;
}

export function invalidateIndexCache(): void {
  _indexCache = null;
  _indexCacheMtime = null;
}

export async function hasIndex(): Promise<boolean> {
  try {
    await fs.access(brainConfig.indexPath);
    return true;
  } catch {
    return false;
  }
}

export async function indexStats(): Promise<
  | { exists: false }
  | { exists: true; createdAt: string; embedModel: string; chunkCount: number; campaigns: Record<string, number> }
> {
  if (!(await hasIndex())) return { exists: false };
  const index = await loadIndex();
  const campaigns = new Map<string, number>();
  for (const item of index.items) {
    const campaign = item.metadata.campaign ?? "All";
    campaigns.set(campaign, (campaigns.get(campaign) ?? 0) + 1);
  }
  return {
    exists: true,
    createdAt: index.createdAt,
    embedModel: index.embedModel,
    chunkCount: index.chunkCount,
    campaigns: Object.fromEntries(campaigns),
  };
}

export function searchIndex(
  index: BrainIndex,
  queryEmbedding: number[],
  options: { topK?: number; campaign?: string; visibility?: string; queryText?: string } = {},
): IndexItem[] {
  const topK = options.topK ?? brainConfig.topK;
  const campaign = options.campaign ?? "All";
  const visibility = options.visibility ?? "players";
  const queryText = options.queryText ?? "";

  return index.items
    .filter((item) => isVisible(item.metadata, visibility))
    .filter((item) => isCampaignAllowed(item.metadata, campaign))
    .map((item) => {
      const semanticScore = cosineSimilarity(queryEmbedding, item.embedding);
      const lexicalScoreValue = computeLexicalScore(queryText, item);
      return {
        ...item,
        semanticScore,
        lexicalScore: lexicalScoreValue,
        score: semanticScore * 0.72 + lexicalScoreValue * 0.28,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, topK);
}

export async function saveIndex(
  chunks: { id: string; text: string; metadata: ChunkMetadata }[],
  embeddings: number[][],
  browseOnlyDocuments: { relativePath: string; metadata: ChunkMetadata }[] = [],
  fileHashes: Record<string, string> = {},
): Promise<BrainIndex> {
  await fs.mkdir(brainConfig.dataDir, { recursive: true });
  const items: IndexItem[] = chunks.map((chunk, index) => ({
    id: stableId(chunk.id),
    text: chunk.text,
    metadata: chunk.metadata,
    embedding: embeddings[index],
  }));

  const index: BrainIndex = {
    version: 2,
    createdAt: new Date().toISOString(),
    embedModel: brainConfig.embedModel,
    chunkCount: items.length,
    fileHashes,
    pages: buildPageGraph(items, browseOnlyDocuments),
    items,
  };

  await fs.writeFile(brainConfig.indexPath, JSON.stringify(index, null, 2));
  invalidateIndexCache();
  return index;
}

function buildPageGraph(
  items: IndexItem[],
  browseOnlyDocuments: { relativePath: string; metadata: ChunkMetadata }[],
): Record<string, PageEntry> {
  const pages = new Map<string, PageEntry>();

  for (const item of items) {
    const pathKey = item.metadata.path;
    if (!pages.has(pathKey)) {
      pages.set(pathKey, {
        path: pathKey,
        title: item.metadata.title,
        campaign: item.metadata.campaign,
        visibility: item.metadata.visibility,
        links: [...new Set(item.metadata.links ?? [])],
        backlinks: [],
      });
    }
  }

  for (const doc of browseOnlyDocuments) {
    const pathKey = doc.relativePath;
    if (!pages.has(pathKey)) {
      pages.set(pathKey, {
        path: pathKey,
        title: doc.metadata.title,
        campaign: doc.metadata.campaign,
        visibility: doc.metadata.visibility,
        links: [...new Set(doc.metadata.links ?? [])],
        backlinks: [],
      });
    }
  }

  for (const page of pages.values()) {
    for (const link of page.links) {
      if (!pages.has(link)) continue;
      const linkedPage = pages.get(link)!;
      if (!linkedPage.backlinks.includes(page.path)) {
        linkedPage.backlinks.push(page.path);
      }
    }
  }

  return Object.fromEntries(
    [...pages.entries()].map(([pagePath, page]) => [
      pagePath,
      { ...page, backlinks: page.backlinks.sort(), links: page.links.sort() },
    ]),
  );
}

function isCampaignAllowed(metadata: ChunkMetadata, campaign: string): boolean {
  if (campaign === "All") return true;
  return (
    metadata.campaign === campaign ||
    metadata.campaign === "World" ||
    isSharedWorldPath(metadata.path)
  );
}

function isSharedWorldPath(sourcePath: string): boolean {
  const normalized = String(sourcePath ?? "").replaceAll(path.sep, "/");
  return (
    normalized.startsWith("wiki/world/") ||
    normalized === "wiki/concepts/Pantheon of Myrdae.md"
  );
}

function isVisible(metadata: ChunkMetadata, requestedVisibility: string): boolean {
  if (requestedVisibility === "dm") return true;
  return metadata.visibility !== "dm";
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function stableId(input: string): string {
  const hash = crypto.createHash("sha1").update(input).digest("hex").slice(0, 14);
  return `${path.basename(input).replace(/[^A-Za-z0-9_-]/g, "-")}-${hash}`;
}

function computeLexicalScore(queryText: string, item: IndexItem): number {
  const tokens = tokenize(queryText);
  if (!tokens.length) return 0;

  const title = normalizeText(item.metadata.title);
  const heading = normalizeText(item.metadata.heading);
  const pathText = normalizeText(item.metadata.path);
  const body = normalizeText(item.text);
  const fullText = `${title} ${heading} ${pathText} ${body}`;
  const phrase = normalizeText(queryText);

  let score = 0;
  if (phrase && title.includes(phrase)) score += 0.45;
  if (phrase && heading.includes(phrase)) score += 0.2;
  if (phrase && body.includes(phrase)) score += 0.18;

  let tokenHits = 0;
  for (const token of tokens) {
    if (title.split(" ").includes(token)) score += 0.16;
    if (heading.split(" ").includes(token)) score += 0.08;
    if (pathText.split(" ").includes(token)) score += 0.06;
    if (fullText.includes(token)) { tokenHits++; score += 0.03; }
  }

  score += (tokenHits / tokens.length) * 0.2;
  return Math.min(score, 1);
}

function tokenize(value: string): string[] {
  const stopwords = new Set(["a", "an", "and", "are", "about", "does", "for", "in", "is", "of", "the", "to", "was", "what", "who"]);
  return normalizeText(value)
    .split(" ")
    .filter((t) => t.length > 1 && !stopwords.has(t));
}

function normalizeText(value: string): string {
  return String(value).toLowerCase().replaceAll("'", "").replace(/[^a-z0-9]+/g, " ").trim();
}
