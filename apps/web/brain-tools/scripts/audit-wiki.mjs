import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../src/config.mjs";
import { extractWikiLinks, parseFrontmatter, titleFromMarkdown } from "../src/markdown.mjs";

const wikiRoot = path.join(config.vaultRoot, "wiki");
const indexPath = path.join(config.vaultRoot, "index.md");
const fullIndexPath = path.join(config.vaultRoot, "wiki", "indexes", "Full Wiki Page Index.md");
const ignoredOrphanPatterns = [
  /^wiki\/sources\//,
  /^wiki\/indexes\//,
  /^wiki\/maps\//,
  /^wiki\/world\/gods\/README\.md$/
];

async function main() {
  const markdownFiles = [
    indexPath,
    ...(await findMarkdownFiles(wikiRoot))
  ];

  const pages = [];
  for (const filePath of markdownFiles) {
    const raw = await fs.readFile(filePath, "utf8");
    const relativePath = normalizePath(path.relative(config.vaultRoot, filePath));
    const { body } = parseFrontmatter(raw);
    const title = titleFromMarkdown(body, filePath);
    pages.push({ filePath, relativePath, title, body });
  }

  const lookup = buildLookup(pages);
  const brokenLinks = [];
  const ambiguousLinks = [];
  const incoming = new Map(pages.map((page) => [page.relativePath, new Set()]));

  for (const page of pages) {
    for (const rawLink of extractWikiLinks(page.body)) {
      if (await isExistingRawOrMarkdownPath(rawLink)) continue;
      const candidates = lookup.get(normalizeLinkKey(rawLink)) ?? lookup.get(sessionAliasKey(rawLink)) ?? [];
      const resolved = resolveWikiLink(rawLink, lookup, page);
      if (!resolved) {
        brokenLinks.push({ from: page.relativePath, link: rawLink });
        continue;
      }
      if (candidates.length > 1) {
        ambiguousLinks.push({ from: page.relativePath, link: rawLink, resolved, candidates });
      }
      incoming.get(resolved)?.add(page.relativePath);
    }
  }

  const indexRaw = await fs.readFile(indexPath, "utf8");
  const fullIndexRaw = await fs.readFile(fullIndexPath, "utf8").catch(() => "");
  const indexLinks = new Set(
    extractWikiLinks(`${indexRaw}\n${fullIndexRaw}`)
      .map((link) => resolveWikiLink(link, lookup, pages.find((page) => page.relativePath === "index.md")))
      .filter(Boolean)
  );
  const pagesMissingFromIndex = pages
    .filter((page) => page.relativePath !== "index.md")
    .filter((page) => !isBrowseOnly(page.relativePath))
    .filter((page) => !indexLinks.has(page.relativePath))
    .map((page) => page.relativePath);

  const orphanPages = pages
    .filter((page) => page.relativePath !== "index.md")
    .filter((page) => !ignoredOrphanPatterns.some((pattern) => pattern.test(page.relativePath)))
    .filter((page) => (incoming.get(page.relativePath)?.size ?? 0) === 0)
    .map((page) => page.relativePath);

  const duplicateTitles = [...lookup.entries()]
    .filter(([key, candidates]) => candidates.length > 1 && key.includes("/"))
    .map(([key, candidates]) => ({ key, candidates }));

  const report = {
    pageCount: pages.length,
    brokenLinks,
    ambiguousLinks,
    orphanPages,
    pagesMissingFromIndex,
    duplicatePathKeys: duplicateTitles
  };

  printReport(report);

  if (brokenLinks.length) {
    process.exitCode = 1;
  }
}

async function findMarkdownFiles(root) {
  const results = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".")) await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }
  await walk(root);
  return results.sort();
}

function buildLookup(pages) {
  const lookup = new Map();
  for (const page of pages) {
    const basename = path.basename(page.relativePath, ".md");
    const withoutWikiPrefix = page.relativePath.replace(/^wiki\//, "").replace(/\.md$/, "");
    const keys = [
      page.title,
      basename,
      withoutWikiPrefix,
      page.relativePath.replace(/\.md$/, "")
    ];
    for (const key of keys) addLookup(lookup, key, page.relativePath);
    const aliasKey = sessionAliasKey(basename);
    if (aliasKey) addLookup(lookup, aliasKey, page.relativePath);
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

function addLookup(lookup, key, relativePath) {
  const normalized = normalizeLinkKey(key);
  if (!normalized) return;
  if (!lookup.has(normalized)) lookup.set(normalized, []);
  const candidates = lookup.get(normalized);
  if (!candidates.includes(relativePath)) candidates.push(relativePath);
}

function normalizeLinkKey(value) {
  return String(value).toLowerCase().replaceAll("\\", "/").replace(/\.md$/i, "").replace(/\/+$/g, "").trim();
}

function normalizePath(value) {
  return String(value).replaceAll("\\", "/");
}

function resolveWikiLink(link, lookup, sourcePage) {
  const candidates = lookup.get(normalizeLinkKey(link)) ?? lookup.get(sessionAliasKey(link)) ?? [];
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const exactPath = normalizeLinkKey(link).includes("/")
    ? candidates.find((candidate) => normalizeLinkKey(candidate) === normalizeLinkKey(link) || normalizeLinkKey(candidate.replace(/^wiki\//, "")) === normalizeLinkKey(link))
    : null;
  if (exactPath) return exactPath;

  const sourceCampaign = inferCampaign(sourcePage.relativePath, sourcePage.body);
  if (sourcePage.relativePath.startsWith("wiki/world/") || sourceCampaign === "World") {
    const worldCandidate = candidates.find((candidate) => candidate.startsWith("wiki/world/"));
    if (worldCandidate) return worldCandidate;
  }

  const sameCampaignCandidate = candidates.find((candidate) => inferCampaign(candidate, "") === sourceCampaign);
  if (sameCampaignCandidate) return sameCampaignCandidate;

  const summaryCandidate = candidates.find((candidate) => candidate.startsWith("wiki/summaries/"));
  if (summaryCandidate) return summaryCandidate;

  const nonSourceCandidate = candidates.find((candidate) => !candidate.startsWith("wiki/sources/"));
  return nonSourceCandidate ?? candidates[0];
}

async function isExistingRawOrMarkdownPath(link) {
  const normalized = String(link).replaceAll("\\", "/").replace(/^\/+/, "");
  if (!/^(raw|wiki)\//.test(normalized)) return false;
  const target = path.join(config.vaultRoot, normalized);
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
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

function inferCampaign(relativePath, body) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const basename = path.basename(relativePath, ".md");
  if (["index.md", "wiki/overview.md", "wiki/synthesis.md"].includes(normalizedPath)) return "All";
  if (normalizedPath.startsWith("wiki/world/") || normalizedPath === "wiki/concepts/Pantheon of Myrdae.md") return "World";
  if (normalizedPath.includes("/The Silent Vanguard/") || basename.includes("(TSV)") || /\bTSV\b/.test(basename) || basename.includes("Silent Vanguard")) return "The Silent Vanguard";
  if (normalizedPath.includes("/Dungeons III/") || /\bDungeons III\b/i.test(basename) || /\bDungeons 3\b/i.test(basename) || /\bD3\b/.test(basename)) return "Dungeons III";
  if (normalizedPath.includes("/Bloody Endeavor/") || normalizedPath.includes("/Wyrm Bane/") || /^WB Session\b/.test(basename)) return "Bloody Endeavor";
  if (normalizedPath.includes("/SoD/") || /\bSoD\b/.test(basename)) return "SoD";
  if (normalizedPath.includes("/HoE/") || /\bHoE\b/.test(basename)) return "HoE";

  const explicitCampaign = body.match(/(?:^|\n)\s*(?:[-*]\s*)?(?:Campaign|Campaign Scope):\s*(HoE|SoD|The Silent Vanguard|Bloody Endeavor|Wyrm Bane|Dungeons III|Dungeons 3|D3)\b/i);
  if (explicitCampaign) return normalizeCampaignName(explicitCampaign[1]);
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

function isBrowseOnly(relativePath) {
  return /^wiki\/indexes\//.test(relativePath) || /^wiki\/maps\//.test(relativePath);
}

function printReport(report) {
  console.log(`Wiki pages: ${report.pageCount}`);
  printList("Broken links", report.brokenLinks, (item) => `${item.from} -> [[${item.link}]]`);
  printList("Ambiguous links", report.ambiguousLinks, (item) => `${item.from} -> [[${item.link}]] => ${item.resolved} (${item.candidates.join(", ")})`);
  printList("Orphan pages", report.orphanPages, (item) => item);
  printList("Pages missing from index", report.pagesMissingFromIndex, (item) => item);
  printList("Duplicate path keys", report.duplicatePathKeys, (item) => `${item.key} => ${item.candidates.join(", ")}`);
}

function printList(title, values, render) {
  console.log(`\n${title}: ${values.length}`);
  for (const value of values.slice(0, 50)) console.log(`- ${render(value)}`);
  if (values.length > 50) console.log(`- ... ${values.length - 50} more`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
