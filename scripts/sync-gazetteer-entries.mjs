// Sync Gazetteer entries from the shared Google Drive folder.
// A settlement is defined by a subfolder in the Gazetteer folder.
// Size, region, and the Reference hyperlink are pulled from the Campaign
// Setting settlements table when present. Heraldry is pulled from each
// settlement subfolder by preferring "<name> - Heraldry (v.0)" or "(v0)",
// with a folder-local heraldry fallback for spelling/punctuation variants.
//
// Requires GOOGLE_API_KEY with the Google Drive API enabled.
// Add it to .env.local or set it in the system/shell environment.
//
// Run manually:  node scripts/sync-gazetteer-entries.mjs
// Scheduled:     scripts/sync-lore.cmd
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./sync-db.mjs";
import { readContent, writeContent } from "./content-documents.mjs";
import { listDriveItems } from "./drive-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function configuredDriveFolderUrl(pagePath, labelPattern, fallback) {
  try {
    const pages = readContent("auto-managed-pages.json");
    const page = pages.find((p) => p.path === pagePath);
    const source = page?.managedSources?.find((s) => labelPattern.test(s.label));
    return source?.url ?? page?.sourceUrl ?? fallback;
  } catch {
    return fallback;
  }
}

function folderIdFromUrl(url) {
  return /\/folders\/([a-zA-Z0-9_-]+)/.exec(url)?.[1] ?? null;
}

const driveFolderUrl = configuredDriveFolderUrl(
  "/gazetteer",
  /settlement docs/i,
  "https://drive.google.com/drive/folders/1idEf0ZY4tSnwaoQbVUZWtcwGdeBlbSTg",
);
const driveFolderId = folderIdFromUrl(driveFolderUrl) ?? "1idEf0ZY4tSnwaoQbVUZWtcwGdeBlbSTg";
const campaignSettingDocId = "1PGWzoocfjPNQ69Q-JsVmNXCFo76a3Z_IkcBuBeDj4yQ";

const SKIPPED_FOLDER_TITLES = new Set(["new folder", "inspiration"]);

// --- Drive item helpers ------------------------------------------------------

function toCommonItem(file) {
  return {
    id: file.id,
    title: file.name,
    isFolder: file.mimeType === "application/vnd.google-apps.folder",
    isGoogleDoc: file.mimeType === "application/vnd.google-apps.document",
    isImage: (file.mimeType ?? "").startsWith("image/"),
  };
}

// --- Metadata fetch (Campaign Setting doc export) ----------------------------

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed for ${url}: HTTP ${res.status}`);
  return res.text();
}

// --- String utilities --------------------------------------------------------

function clean(value) {
  return decodeHtml(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/!\[[^\]]*\]\[[^\]]+\]/g, "")
    .replace(/\\([*_`\-[\]()])/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/['`]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- Campaign Setting metadata -----------------------------------------------

function getCampaignSettingExportUrl() {
  try {
    const pages = readContent("auto-managed-pages.json");
    const page = pages.find((p) => p.path === "/gazetteer");
    const sourceUrl = page?.fallbackSourceUrl ?? "";
    const match = /\/document\/d\/([\w-]+)/.exec(sourceUrl);
    if (match) return `https://docs.google.com/document/d/${match[1]}/export?format=md`;
  } catch {
    // Fall through to the default Campaign Setting document.
  }
  return `https://docs.google.com/document/d/${campaignSettingDocId}/export?format=md`;
}

function splitMarkdownRow(line) {
  return line.split("|").slice(1, -1).map((cell) => cell.trim());
}

function parseSettlementMetadata(markdown) {
  const lines = markdown.split("\n");
  const headerIndex = lines.findIndex((line) =>
    /^\|\s*Heraldry\s*\|\s*Settlement\s*\|\s*Size\s*\|\s*Coord\.\s*\|\s*Region\s*\|\s*Description\s*\|/.test(
      line.replaceAll("*", ""),
    ),
  );
  if (headerIndex < 0) return new Map();

  const rows = new Map();
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith("|")) break;
    if (/^\|[\s:|-]+\|$/.test(line)) continue;

    const cells = splitMarkdownRow(line);
    if (cells.length < 6) continue;

    const link = cells[1].match(/\[([^\]]+)\]\((https:\/\/docs\.google\.com\/document\/d\/[^)]+)\)/);
    const name = clean(link?.[1] ?? cells[1]);
    if (!name) continue;

    rows.set(slugify(name), {
      name,
      referenceUrl: link?.[2] ?? null,
      size: clean(cells[2]),
      region: clean(cells[4]),
      description: clean(cells[5]),
    });
  }
  return rows;
}

// --- Drive URL helpers -------------------------------------------------------

function toDriveFolderUrl(id) {
  return `https://drive.google.com/drive/folders/${id}`;
}

function toDriveThumbnailUrl(id) {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w500`;
}

function toDocUrl(id) {
  return `https://docs.google.com/document/d/${id}/edit?usp=sharing`;
}

// --- Heraldry selection ------------------------------------------------------

function normalizedName(value) {
  return clean(value)
    .toLowerCase()
    .replace(/['`]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function versionNumber(title) {
  const match = clean(title).match(/\bv\.?\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return Number.parseFloat(match[1]);
}

function isVersionZero(title) {
  const version = versionNumber(title);
  return version === 0;
}

function isSmallDerivative(title) {
  return /\b(500px|small|thumbnail)\b/i.test(clean(title));
}

function heraldryScore(item, settlementName) {
  if (!item.isImage || !/\bheraldry\b/i.test(clean(item.title))) return -1;

  const title = clean(item.title);
  const titlePrefix = normalizedName(title.split(/\s+-\s+heraldry/i)[0] ?? "");
  const settlement = normalizedName(settlementName);
  const version = versionNumber(title);
  let score = 100;

  if (titlePrefix && titlePrefix === settlement) score += 1000;
  if (isVersionZero(title)) score += 500;
  if (version !== null && !isVersionZero(title)) score += Math.min(version, 99);
  if (isSmallDerivative(title)) score += 10;

  return score;
}

function selectHeraldryImage(items, settlementName) {
  return items
    .map((item, index) => ({ item, index, score: heraldryScore(item, settlementName) }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.item ?? null;
}

function isGazetteerReference(item) {
  return item.isGoogleDoc && /\bgazetteer\b/i.test(item.title);
}

// --- Settlement folder inspection --------------------------------------------

async function inspectSettlementFolder(folder) {
  const rawItems = await listDriveItems(folder.id);
  const items = rawItems.map(toCommonItem);
  const heraldry = selectHeraldryImage(items, folder.title);
  const reference = items.find(isGazetteerReference);

  return {
    folderId: folder.id,
    title: folder.title,
    slug: slugify(folder.title),
    folderUrl: toDriveFolderUrl(folder.id),
    referenceUrl: reference ? toDocUrl(reference.id) : null,
    referenceFileId: reference?.id ?? null,
    heraldryUrl: heraldry ? toDriveThumbnailUrl(heraldry.id) : null,
    heraldryFileId: heraldry?.id ?? null,
    heraldryFileName: heraldry?.title ?? null,
  };
}

// --- Layout helpers ----------------------------------------------------------

function walkItems(itemsJson, visitor) {
  let parsed;
  try {
    parsed = JSON.parse(itemsJson);
  } catch {
    return;
  }
  for (const item of parsed) {
    visitor(item);
    if (typeof item.props?.items === "string") walkItems(item.props.items, visitor);
  }
}

function updateNestedItem(itemsJson, targetId, propUpdates) {
  let parsed;
  try {
    parsed = JSON.parse(itemsJson);
  } catch {
    return { itemsJson, changed: false };
  }
  let changed = false;
  for (const item of parsed) {
    if (item.id === targetId) {
      Object.assign(item.props ??= {}, propUpdates);
      changed = true;
    }
    if (typeof item.props?.items === "string") {
      const result = updateNestedItem(item.props.items, targetId, propUpdates);
      if (result.changed) {
        item.props.items = result.itemsJson;
        changed = true;
      }
    }
  }
  const indent = itemsJson.includes("\n") ? 2 : undefined;
  return { itemsJson: JSON.stringify(parsed, null, indent), changed };
}

function updateLayoutItem(layout, targetId, propUpdates) {
  let changed = false;
  for (const block of layout) {
    if (block.id === targetId) {
      Object.assign(block.props ??= {}, propUpdates);
      changed = true;
    }
    if (typeof block.props?.items === "string") {
      const result = updateNestedItem(block.props.items, targetId, propUpdates);
      if (result.changed) {
        block.props.items = result.itemsJson;
        changed = true;
      }
    }
  }
  return changed;
}

// --- DB helpers --------------------------------------------------------------

function ensureGazetteerColumns(db) {
  const columns = new Set(db.prepare(`PRAGMA table_info(gazetteer)`).all().map((row) => row.name));
  const addColumn = (name, type) => {
    if (!columns.has(name)) db.exec(`ALTER TABLE gazetteer ADD COLUMN ${name} ${type}`);
  };
  addColumn("folder_url", "TEXT");
  addColumn("reference_url", "TEXT");
  addColumn("image_url", "TEXT");
  addColumn("image_source_file_id", "TEXT");
  addColumn("image_source_file_name", "TEXT");
  addColumn("size", "TEXT");
  addColumn("region", "TEXT");
  addColumn("description", "TEXT");
}

// --- Main --------------------------------------------------------------------

const stamp = new Date().toISOString();

const rootApiItems = await listDriveItems(driveFolderId);
const foldersById = new Map();
for (const file of rootApiItems) {
  const item = toCommonItem(file);
  if (!item.isFolder) continue;
  if (SKIPPED_FOLDER_TITLES.has(item.title.toLowerCase())) continue;
  foldersById.set(item.id, item);
}
const folders = [...foldersById.values()].sort((a, b) => a.title.localeCompare(b.title));

if (!folders.length) {
  throw new Error(`No settlement folders found in Gazetteer Drive folder (${driveFolderId}).`);
}

const metadataMarkdown = await fetchText(getCampaignSettingExportUrl());
const metadataBySlug = parseSettlementMetadata(metadataMarkdown);

const entries = [];
for (const folder of folders) {
  const inspected = await inspectSettlementFolder(folder);
  const metadata = metadataBySlug.get(inspected.slug);
  const referenceUrl = metadata?.referenceUrl ?? inspected.referenceUrl ?? inspected.folderUrl;
  entries.push({
    id: inspected.folderId,
    title: metadata?.name ?? inspected.title,
    slug: inspected.slug,
    docUrl: referenceUrl,
    folderUrl: inspected.folderUrl,
    referenceUrl,
    imageUrl: inspected.heraldryUrl,
    imageSourceFileId: inspected.heraldryFileId,
    imageSourceFileName: inspected.heraldryFileName,
    size: metadata?.size ?? "",
    region: metadata?.region ?? "",
    description: metadata?.description ?? "",
    hasReference: Boolean(metadata?.referenceUrl || inspected.referenceUrl),
  });
}

const db = getDb();
ensureGazetteerColumns(db);
const existing = db.prepare(`
  SELECT id, title, slug, doc_url AS docUrl FROM gazetteer
`).all();

const merged = [...entries].sort((a, b) => a.title.localeCompare(b.title));

const changes = [];
const warnings = [];

const previous = existing.length;
const upsert = db.prepare(`
  INSERT OR REPLACE INTO gazetteer (
    id,
    title,
    slug,
    doc_url,
    folder_url,
    reference_url,
    image_url,
    image_source_file_id,
    image_source_file_name,
    size,
    region,
    description
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

if (previous > 0 && merged.length < Math.ceil(previous * 0.5)) {
  throw new Error(
    `Refusing to replace ${previous} gazetteer entries with only ${merged.length} — looks like a partial Drive API response. Run again or check the API quota.`,
  );
}

db.transaction(() => {
  db.prepare(`DELETE FROM gazetteer`).run();
  for (const entry of merged) {
    upsert.run(
      entry.id,
      entry.title,
      entry.slug,
      entry.docUrl,
      entry.folderUrl ?? null,
      entry.referenceUrl ?? entry.docUrl,
      entry.imageUrl ?? null,
      entry.imageSourceFileId ?? null,
      entry.imageSourceFileName ?? null,
      entry.size ?? "",
      entry.region ?? "",
      entry.description ?? "",
    );
  }
})();

if (merged.length !== previous) {
  changes.push(`gazetteer: ${previous} -> ${merged.length} entries`);
}

writeContent(
  "gazetteer.json",
  merged.map((entry) => ({
    id: entry.id,
    title: entry.title,
    slug: entry.slug,
    docUrl: entry.docUrl,
    folderUrl: entry.folderUrl ?? null,
    referenceUrl: entry.referenceUrl ?? entry.docUrl,
    imageUrl: entry.imageUrl ?? null,
    imageSourceFileId: entry.imageSourceFileId ?? null,
    imageSourceFileName: entry.imageSourceFileName ?? null,
    size: entry.size ?? "",
    region: entry.region ?? "",
    description: entry.description ?? "",
  })),
);

const layout = readContent("page-layouts/gazetteer.json");
const documentedCount = entries.filter((entry) => entry.hasReference).length;
const inProgressCount = Math.max(0, entries.length - documentedCount);

const completeChanged = updateLayoutItem(layout, "complete-count", { title: String(documentedCount) });
const progressChanged = updateLayoutItem(layout, "progress-count", { title: String(inProgressCount) });

if (completeChanged || progressChanged) {
  writeContent("page-layouts/gazetteer.json", layout);
  changes.push(`gazetteer layout stats: ${documentedCount} documented, ${inProgressCount} in progress`);
}

for (const entry of entries) {
  if (!entry.hasReference) {
    warnings.push(`Settlement folder has no Gazetteer reference doc yet: ${entry.title} (${entry.folderUrl})`);
  }
  if (!entry.imageUrl) {
    warnings.push(`Settlement folder has no heraldry image: ${entry.title} (${entry.folderUrl})`);
  }
}

console.log(`[${stamp}] Gazetteer entries synced from Drive folder ${driveFolderId}`);
console.log(`  Fetched ${folders.length} settlement folders via Drive API. Total known entries: ${merged.length}.`);
console.log(`  Layout stats: ${documentedCount} documented, ${inProgressCount} in progress.`);

if (changes.length) {
  console.log("Changes:");
  for (const change of changes) console.log(`  ${change}`);
} else {
  console.log("No changes.");
}

if (warnings.length) {
  console.log("Warnings:");
  for (const warning of warnings) console.log(`  ${warning}`);
}
