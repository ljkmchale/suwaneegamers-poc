import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { cleanMarkdown, extractWikiLinks, parseFrontmatter, splitMarkdownByHeading, titleFromMarkdown } from "./markdown.mjs";

const excludedDirs = new Set([".git", ".obsidian", ".smart-env", "brain-query", "node_modules", "raw"]);
const queryExcludedRootFiles = new Set(["log.md"]);

const browseOnlyDirs = new Set(["indexes", "maps"]);
const browseOnlyFiles = new Set(["Open Threads By Campaign.md", "Character Personal Threads Index.md"]);

export async function loadVaultDocuments() {
  const files = [
    path.join(config.vaultRoot, "index.md"),
    ...(await findMarkdownFiles(path.join(config.vaultRoot, "wiki")))
  ].filter((filePath) => !isQueryExcludedFile(filePath));

  const documents = [];
  for (const filePath of files) {
    const raw = await fs.readFile(filePath, "utf8");
    const relativePath = path.relative(config.vaultRoot, filePath).replaceAll(path.sep, "/");
    const { frontmatter, body } = parseFrontmatter(raw);
    const title = frontmatter.title || titleFromMarkdown(body, filePath);
    const metadata = {
      path: relativePath,
      title,
      campaign: inferCampaign(relativePath, body, frontmatter),
      visibility: normalizeVisibility(frontmatter.visibility || frontmatter.audience || frontmatter.access),
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      mtimeMs: (await fs.stat(filePath)).mtimeMs,
      browseOnly: isBrowseOnly(relativePath)
    };

    documents.push({
      filePath,
      relativePath,
      frontmatter,
      body,
      metadata
    });
  }

  const pageLookup = createPageLookup(documents);
  for (const document of documents) {
    document.metadata.links = extractWikiLinks(document.body)
      .map((link) => resolveWikiLink(link, pageLookup, document))
      .filter(Boolean);
  }

  return documents;
}

export function chunkDocuments(documents) {
  const chunks = [];
  for (const document of documents.filter((d) => !d.metadata.browseOnly)) {
    const sections = splitMarkdownByHeading(document.body);
    for (const section of sections) {
      const cleaned = cleanMarkdown(section.text);
      if (!cleaned) continue;
      const pieces = splitText(cleaned, config.chunkMaxChars, config.chunkOverlapChars);
      pieces.forEach((piece, index) => {
        chunks.push({
          id: `${document.relativePath}#${section.heading}#${index}`,
          text: piece,
          metadata: {
            ...document.metadata,
            heading: section.heading,
            chunkIndex: index
          }
        });
      });
    }
  }
  return chunks;
}

async function findMarkdownFiles(root) {
  const results = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".") continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excludedDirs.has(entry.name)) await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }

    }
  }

  await walk(root);
  return results.sort();
}

function splitText(text, maxChars, overlapChars) {
  if (text.length <= maxChars) return [text];

  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    const boundary = text.lastIndexOf("\n\n", end);
    if (boundary > start + Math.floor(maxChars * 0.55)) end = boundary;
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(0, end - overlapChars);
  }
  return chunks.filter(Boolean);
}

function isBrowseOnly(relativePath) {
  const normalized = relativePath.replaceAll(path.sep, "/");
  if (browseOnlyFiles.has(path.basename(relativePath))) return true;
  return [...browseOnlyDirs].some((dir) => normalized.includes(`/wiki/${dir}/`) || normalized.startsWith(`wiki/${dir}/`));
}

function createPageLookup(documents) {
  const lookup = new Map();
  for (const document of documents) {
    const title = document.metadata.title;
    const basename = path.basename(document.relativePath, ".md");
    const withoutWikiPrefix = document.relativePath.replace(/^wiki\//, "").replace(/\.md$/, "");
    for (const key of [title, basename, withoutWikiPrefix, document.relativePath.replace(/\.md$/, "")]) {
      addLookup(lookup, key, document.relativePath);
    }
    const aliasKey = sessionAliasKey(basename);
    if (aliasKey) addLookup(lookup, aliasKey, document.relativePath);
  }
  addLookup(lookup, "Wyrm Bane Timeline", "wiki/timelines/Bloody Endeavor Timeline.md");
  addLookup(lookup, "Wyrm Bane - Campaign Player Notes", "wiki/summaries/Bloody Endeavor - Campaign Player Notes.md");
  addLookup(lookup, "Bloody Endeavor", "wiki/quick/Bloody Endeavor Quick Reference.md");
  addLookup(lookup, "Glimmering Sea", "wiki/world/locations/The Glimmering Sea.md");
  addLookup(lookup, "Orbansia", "wiki/world/Regions of Myrdae.md");
  addLookup(lookup, "Severed Crease", "wiki/world/Regions of Myrdae.md");
  addLookup(lookup, "Rothenloch", "wiki/world/locations/Nunglthil.md");
  addLookup(lookup, "Var'Shala", "wiki/world/Regions of Myrdae.md");
  addLookup(lookup, "SoD - Gibuldon", "wiki/locations/SoD/Gibuldon.md");
  addLookup(lookup, "Ossana", "wiki/concepts/Pantheon of Myrdae.md");
  addLookup(lookup, "Old Dicon House", "wiki/world/locations/Dha'Chaomhnoir.md");
  addLookup(lookup, "The Vaults", "wiki/world/locations/Dha'Chaomhnoir.md");
  addLookup(lookup, "Tegenwald Phet", "wiki/world/locations/Dha'Chaomhnoir.md");
  addPantheonAliases(lookup);
  return lookup;
}

function isQueryExcludedFile(filePath) {
  const relativePath = path.relative(config.vaultRoot, filePath).replaceAll(path.sep, "/");
  return queryExcludedRootFiles.has(relativePath);
}

function addLookup(lookup, key, relativePath) {
  const normalized = normalizeLinkKey(key);
  if (!lookup.has(normalized)) lookup.set(normalized, []);
  const candidates = lookup.get(normalized);
  if (!candidates.includes(relativePath)) candidates.push(relativePath);
}

function resolveWikiLink(link, pageLookup, sourceDocument) {
  const candidates = pageLookup.get(normalizeLinkKey(link)) ?? pageLookup.get(sessionAliasKey(link)) ?? [];
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const sourceCampaign = sourceDocument.metadata.campaign;
  const sourcePath = sourceDocument.relativePath.replaceAll(path.sep, "/");
  const exactPath = normalizeLinkKey(link).includes("/")
    ? candidates.find((candidate) => normalizeLinkKey(candidate) === normalizeLinkKey(link) || normalizeLinkKey(candidate.replace(/^wiki\//, "")) === normalizeLinkKey(link))
    : null;
  if (exactPath) return exactPath;

  if (sourcePath.startsWith("wiki/world/") || sourceCampaign === "World") {
    const worldCandidate = candidates.find((candidate) => candidate.startsWith("wiki/world/"));
    if (worldCandidate) return worldCandidate;
  }

  const sameCampaignCandidate = candidates.find((candidate) => inferCampaign(candidate, "", {}) === sourceCampaign);
  if (sameCampaignCandidate) return sameCampaignCandidate;

  const summaryCandidate = candidates.find((candidate) => candidate.startsWith("wiki/summaries/"));
  if (summaryCandidate) return summaryCandidate;

  const nonSourceCandidate = candidates.find((candidate) => !candidate.startsWith("wiki/sources/"));
  return nonSourceCandidate ?? candidates[0];
}

function addPantheonAliases(lookup) {
  for (const deity of [
    "Addan", "Amriel", "Asmodeus", "Brault", "Celestine", "Cembus", "Coralei", "Crael",
    "Diverra", "Eredra", "Fralee", "Goldraen", "Iuz'Obal", "Layeth", "Muerg", "Myrdris",
    "Natafae", "Nigrum", "Ol'Farium", "Osanna", "Phoe", "Sylunara", "Tornia", "Tyvarion",
    "Urlich", "Utheri", "Villari", "Vo'egurn"
  ]) {
    addLookup(lookup, deity, "wiki/concepts/Pantheon of Myrdae.md");
  }
}

function sessionAliasKey(value) {
  const match = String(value).match(/\b(HoE|SoD|WB|Dungeons III|Silent Vanguard)\s+Session\s+(\d{1,2})\b/i);
  if (!match) return "";
  const prefix = match[1].toLowerCase() === "silent vanguard" ? "Silent Vanguard" : match[1];
  const sessionNumber = match[2].padStart(2, "0");
  return normalizeLinkKey(`${prefix} Session ${sessionNumber}`);
}

function normalizeLinkKey(value) {
  return String(value).toLowerCase().replaceAll(path.sep, "/").replace(/\.md$/i, "").replace(/\/+$/g, "").trim();
}

function inferCampaign(relativePath, body, frontmatter) {
  if (frontmatter.campaign) return String(frontmatter.campaign);
  const normalizedPath = relativePath.replaceAll(path.sep, "/");
  if (["index.md", "wiki/overview.md", "wiki/synthesis.md"].includes(normalizedPath)) return "All";
  if (normalizedPath.startsWith("wiki/world/") || normalizedPath === "wiki/concepts/Pantheon of Myrdae.md") return "World";

  const basename = path.basename(relativePath, ".md");
  if (/\bby campaign\b/i.test(basename)) return "All";
  if (normalizedPath.includes("/The Silent Vanguard/") || basename.includes("(TSV)") || /\bTSV\b/.test(basename) || basename.includes("Silent Vanguard") || basename === "The Silent Vanguard") {
    return "The Silent Vanguard";
  }
  if (normalizedPath.includes("/Dungeons III/") || /\bDungeons III\b/i.test(basename) || /\bDungeons 3\b/i.test(basename) || /\bD3\b/.test(basename)) return "Dungeons III";
  if (normalizedPath.includes("/Bloody Endeavor/") || normalizedPath.includes("/Wyrm Bane/") || /^WB Session\b/.test(basename)) return "Bloody Endeavor";
  if (normalizedPath.includes("/SoD/") || /\bSoD\b/.test(basename)) return "SoD";
  if (normalizedPath.includes("/HoE/") || /\bHoE\b/.test(basename)) return "HoE";

  const explicitCampaign = body.match(/(?:^|\n)\s*(?:[-*]\s*)?(?:Campaign|Campaign Scope):\s*(HoE|SoD|The Silent Vanguard|Bloody Endeavor|Wyrm Bane|Dungeons III|Dungeons 3|D3)\b/i);
  if (explicitCampaign) return normalizeCampaignName(explicitCampaign[1]);

  const scopedOnly = body.match(/\b(HoE|SoD|The Silent Vanguard|Bloody Endeavor|Wyrm Bane|Dungeons III|Dungeons 3|D3)(?:-|\s+)only\b/i);
  if (scopedOnly) return normalizeCampaignName(scopedOnly[1]);

  const parts = relativePath.split(path.sep);
  for (const campaign of ["HoE", "SoD", "The Silent Vanguard", "Bloody Endeavor", "Dungeons III"]) {
    if (parts.includes(campaign) || body.includes(campaign)) return campaign;
  }
  return "All";
}

function normalizeCampaignName(value) {
  const normalized = String(value).toLowerCase().trim();
  if (normalized === "hoe") return "HoE";
  if (normalized === "sod") return "SoD";
  if (normalized === "bloody endeavor" || normalized === "wyrm bane" || normalized === "wb") return "Bloody Endeavor";
  if (normalized === "dungeons iii" || normalized === "dungeons 3" || normalized === "d3") return "Dungeons III";
  return "The Silent Vanguard";
}

function normalizeVisibility(value) {
  if (!value) return "players";
  const normalized = String(value).toLowerCase().trim();
  if (["dm", "private", "secret", "hidden"].includes(normalized)) return "dm";
  if (["public", "player", "players", "shared"].includes(normalized)) return "players";
  return normalized;
}
