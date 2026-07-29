// Syncs the campaign character roster spreadsheet into content/campaign-roster.json.
//
// Source: "PC Info" Google Sheet (Campaign, Player, Character, Species, Class,
// Type/Subclass, Highest Level Achieved, Status, Death Date, Notes). The sheet is
// shared read-only, so it can be exported as CSV without credentials.
//
// Rows are grouped by campaign and matched against both active campaigns (SQLite
// `campaigns` table, names + aliases) and archived campaigns (the
// `archived-campaign-card` blocks in page-layouts/previous-campaigns.json).
// Campaigns that cannot be matched are kept under `unmatched` so nothing is lost.
//
// Usage: node scripts/sync-campaign-roster.mjs

import { getDb } from "./sync-db.mjs";
import { readContent, writeContent } from "./content-documents.mjs";

const SHEET_ID = "18dJmPar88AcVipVvmKesSQDkSi9dzpsYkUngUHpg6z0";
const SHEET_GID = "1198014666";
const SOURCE_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_GID}`;
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

const OUTPUT_FILE = "campaign-roster.json";
const FETCH_TIMEOUT_MS = 60_000;

// Sheet campaign names that don't line up with any site campaign name/alias.
// Maps normalized sheet name -> site campaign id.
const CAMPAIGN_ID_OVERRIDES = new Map([
  ["blisterfel", "the-company"],           // archived "Blisterfel - The Company"
  ["bloody endeavor", "bloody-endeavor-i"], // archived "Bloody Endeavor I"
  ["mydaen misfits", "myrdaen-misfits"],    // sheet typo for "Myrdaen Misfits"
]);

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Minimal CSV parser handling quoted fields with embedded commas/newlines/quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function fetchCsv() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(CSV_URL, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`Sheet export failed: HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function rowToCharacter(cells) {
  const [, player, character, species, klass, subclass, level, status, deathDate, notes] = cells;
  const trimmed = (v) => String(v ?? "").trim();
  const parsedLevel = Number.parseInt(trimmed(level), 10);

  const entry = { character: trimmed(character) };
  if (trimmed(player)) entry.player = trimmed(player);
  if (trimmed(species)) entry.species = trimmed(species);
  if (trimmed(klass)) entry.class = trimmed(klass);
  if (trimmed(subclass) && trimmed(subclass).toLowerCase() !== "n/a") entry.subclass = trimmed(subclass);
  if (Number.isFinite(parsedLevel)) entry.level = parsedLevel;
  if (trimmed(status)) entry.status = trimmed(status);
  if (trimmed(deathDate)) entry.deathDate = trimmed(deathDate);
  if (trimmed(notes)) entry.notes = trimmed(notes);
  return entry;
}

function loadSiteCampaigns() {
  const targets = [];

  // Active campaigns: names + aliases from the relational table.
  const db = getDb();
  const activeRows = db.prepare(`SELECT id, name, aliases FROM campaigns`).all();
  for (const row of activeRows) {
    let aliases = [];
    try { aliases = JSON.parse(row.aliases ?? "[]"); } catch { /* ignore */ }
    targets.push({ id: row.id, name: row.name, kind: "active", names: [row.name, ...aliases] });
  }

  // Archived campaigns: card blocks on the previous-campaigns layout.
  const layout = readContent("page-layouts/previous-campaigns.json");
  const items = Array.isArray(layout) ? layout : layout.order ?? [];
  for (const item of items) {
    if (item.kind !== "block" || item.type !== "archived-campaign-card") continue;
    const { id, title } = item.props ?? {};
    if (!id || !title) continue;
    targets.push({ id, name: title, kind: "archived", names: [title] });
  }

  return targets;
}

function matchCampaign(sheetName, targets) {
  const normalized = normalizeName(sheetName);
  if (!normalized) return undefined;

  const overrideId = CAMPAIGN_ID_OVERRIDES.get(normalized);
  if (overrideId) return targets.find((t) => t.id === overrideId);

  // Exact name/alias match first, then containment either way
  // (e.g. sheet "Mead Society" vs site "Dungeons II - MEAD Society").
  const exact = targets.find((t) => t.names.some((n) => normalizeName(n) === normalized));
  if (exact) return exact;

  return targets.find((t) =>
    t.names.some((n) => {
      const siteName = normalizeName(n);
      return siteName.includes(normalized) || normalized.includes(siteName);
    })
  );
}

async function main() {
  console.log(`[campaign-roster] Fetching sheet ${SHEET_ID} (gid ${SHEET_GID})...`);
  const csv = await fetchCsv();
  const rows = parseCsv(csv).filter((cells) => cells.some((c) => String(c).trim() !== ""));
  if (rows.length < 2) throw new Error("Sheet export returned no data rows");

  const header = rows[0].map((c) => c.trim().toLowerCase());
  if (header[0] !== "campaign" || header[2] !== "character") {
    throw new Error(`Unexpected sheet header: ${rows[0].join(", ")}`);
  }

  const targets = loadSiteCampaigns();
  const campaigns = {};
  const unmatched = {};
  let matchedRows = 0;
  let skippedRows = 0;

  for (const cells of rows.slice(1)) {
    const sheetCampaign = String(cells[0] ?? "").trim();
    const entry = rowToCharacter(cells);
    if (!entry.character) { skippedRows += 1; continue; }
    if (!sheetCampaign) {
      // Trailing block of characters with no campaign listed — keep, don't drop.
      (unmatched["(unspecified)"] ??= []).push(entry);
      continue;
    }

    const target = matchCampaign(sheetCampaign, targets);
    if (target) {
      const bucket = (campaigns[target.id] ??= {
        name: target.name,
        kind: target.kind,
        sheetName: sheetCampaign,
        characters: [],
      });
      bucket.characters.push(entry);
      matchedRows += 1;
    } else {
      (unmatched[sheetCampaign] ??= []).push(entry);
    }
  }

  for (const bucket of Object.values(campaigns)) {
    bucket.characters.sort((a, b) => a.character.localeCompare(b.character));
  }

  const unmatchedNames = Object.keys(unmatched);
  const unmatchedRows = Object.values(unmatched).reduce((sum, list) => sum + list.length, 0);

  writeContent(OUTPUT_FILE, {
    sourceUrl: SOURCE_URL,
    syncedAt: new Date().toISOString(),
    campaigns,
    unmatched,
  });

  console.log(
    `[campaign-roster] Wrote ${OUTPUT_FILE}: ${Object.keys(campaigns).length} campaigns, ` +
    `${matchedRows} characters matched, ${unmatchedRows} in ${unmatchedNames.length} unmatched ` +
    `campaign(s)${unmatchedNames.length ? ` [${unmatchedNames.join(", ")}]` : ""}, ${skippedRows} rows skipped.`
  );
}

main().catch((err) => {
  console.error("[campaign-roster] Sync failed:", err.message ?? err);
  process.exitCode = 1;
});
