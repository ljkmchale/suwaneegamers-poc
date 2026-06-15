// Sync Gazetteer entries from the shared Google Drive folder.
// Maintains content/gazetteer.json with the list of known city docs,
// and updates the "Documented" / "In Progress" stat counters in the
// Gazetteer page layout.
//
// Source: Google Drive folder with one Google Doc per settlement.
// Documented entries = those already rendered as inner-cards in the layout.
// In-progress entries = Drive docs not yet in the layout.
//
// Run manually:  node scripts/sync-gazetteer-entries.mjs
// Scheduled:     scripts/sync-lore.cmd
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./sync-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const driveFolderUrl = "https://drive.google.com/drive/folders/1idEf0ZY4tSnwaoQbVUZWtcwGdeBlbSTg";
const driveFolderId = "1idEf0ZY4tSnwaoQbVUZWtcwGdeBlbSTg";
const layoutFile = path.join(root, "content", "page-layouts", "gazetteer.json");

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripDriveTypeSuffix(title) {
  return title.replace(/ Shared folder$/i, "").replace(/ Image$/i, "").trim();
}

function parseDriveItems(html) {
  const items = [];
  const pattern = /data-id="([^"]+)"[^>]*data-tooltip="([^"]+)"/g;
  for (const match of html.matchAll(pattern)) {
    items.push({
      id: match[1],
      title: stripDriveTypeSuffix(decodeHtml(match[2])),
    });
  }
  return items;
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed for ${url}: HTTP ${res.status}`);
  return res.text();
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Recursively walk items that may be stored as nested JSON strings.
function walkItems(itemsJson, visitor) {
  let parsed;
  try { parsed = JSON.parse(itemsJson); } catch { return; }
  for (const item of parsed) {
    visitor(item);
    if (typeof item.props?.items === "string") walkItems(item.props.items, visitor);
  }
}

// Recursively update an item by id within a nested items JSON string.
// Returns { itemsJson, changed }.
function updateNestedItem(itemsJson, targetId, propUpdates) {
  let parsed;
  try { parsed = JSON.parse(itemsJson); } catch { return { itemsJson, changed: false }; }
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

// Update a top-level or nested item within the layout by id.
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

// Extract all Google Doc IDs referenced in inner-card links within the layout.
function extractDocumentedDocIds(layout) {
  const docIds = new Set();
  for (const block of layout) {
    if (typeof block.props?.items === "string") {
      walkItems(block.props.items, (item) => {
        if (item.type === "link" && typeof item.props?.href === "string") {
          const match = /\/document\/d\/([\w-]+)/.exec(item.props.href);
          if (match) docIds.add(match[1]);
        }
      });
    }
  }
  return docIds;
}

const html = await fetchText(driveFolderUrl);
const driveItems = parseDriveItems(html);

// Filter to Google Docs (exclude images, folders, and other non-doc items by title heuristic).
// Drive Docs don't have a file extension in their title; folders are suffixed "Shared folder".
const docItems = driveItems.filter((item) => !/\.(jpe?g|png|gif|webp|pdf|zip)$/i.test(item.title));

const stamp = new Date().toISOString();

if (!docItems.length) {
  console.warn(`[${stamp}] No Google Docs found in Gazetteer Drive folder (${driveFolderId}).`);
  console.warn("  Note: Drive HTML listing may be incomplete for large folders.");
  process.exit(0);
}

// Build the entry list
const entries = docItems.map((item) => ({
  id: item.id,
  title: item.title,
  slug: slugify(item.title),
  docUrl: `https://docs.google.com/document/d/${item.id}/edit?usp=sharing`,
}));

// Read existing entries from SQLite (preserves previously known entries that
// may have fallen off the Drive listing due to its fetch limitations).
const db = getDb();
const existing = db.prepare(`SELECT id, title, slug, doc_url AS docUrl FROM gazetteer`).all();

const existingById = new Map(existing.map((e) => [e.id, e]));
const newById = new Map(entries.map((e) => [e.id, e]));

// Merge: keep existing entries and add new ones. Never remove entries automatically.
for (const [id, entry] of existingById) {
  if (!newById.has(id)) newById.set(id, entry);
}
const merged = [...newById.values()].sort((a, b) => a.title.localeCompare(b.title));

const changes = [];
const warnings = [];

// Upsert into gazetteer table
const previous = existing.length;
const upsert = db.prepare(`INSERT OR REPLACE INTO gazetteer (id, title, slug, doc_url) VALUES (?, ?, ?, ?)`);
db.transaction(() => {
  for (const entry of merged) {
    upsert.run(entry.id, entry.title, entry.slug, entry.docUrl);
  }
})();
if (merged.length !== previous) {
  changes.push(`gazetteer: ${previous} -> ${merged.length} entries`);
}

// Update stat counters in the layout
const layout = JSON.parse(fs.readFileSync(layoutFile, "utf-8"));
const documentedDocIds = extractDocumentedDocIds(layout);
const documentedCount = documentedDocIds.size;
const inProgressCount = Math.max(0, merged.length - documentedCount);

const completeChanged = updateLayoutItem(layout, "complete-count", { title: String(documentedCount) });
const progressChanged = updateLayoutItem(layout, "progress-count", { title: String(inProgressCount) });

if (completeChanged || progressChanged) {
  fs.writeFileSync(layoutFile, JSON.stringify(layout, null, 2) + "\n", "utf-8");
  changes.push(`gazetteer layout stats: ${documentedCount} documented, ${inProgressCount} in progress`);
}

// Warn about new Drive entries that aren't yet in the layout
for (const entry of entries) {
  if (!documentedDocIds.has(entry.id)) {
    // Only warn if this is genuinely new (not already known from a previous sync)
    if (!existingById.has(entry.id)) {
      warnings.push(`New entry not yet in layout: ${entry.title} (${entry.docUrl})`);
    }
  }
}

console.log(`[${stamp}] Gazetteer entries synced from Drive folder ${driveFolderId}`);
console.log(`  Fetched ${docItems.length} docs from Drive. Total known entries: ${merged.length}.`);
console.log(`  Layout stats: ${documentedCount} documented, ${inProgressCount} in progress.`);

if (driveItems.length < 20) {
  warnings.push(`Only ${driveItems.length} items returned from Drive listing — folder may have more entries than the initial HTML fetch shows.`);
}

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
