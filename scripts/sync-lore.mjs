// Lore sync: pulls the master lore Google Doc (markdown export) and merges
// the Territories table into content/territories.json.
//
// Merge rules (conservative):
//   - Changed capital/region/description -> updated automatically
//   - New territory in the doc           -> added (image/href empty, flagged)
//   - Territory missing from the doc     -> kept on site, flagged for review
//
// Run manually:  node scripts/sync-lore.mjs
// Scheduled:     scripts/sync-lore.cmd (SuwaneeGamers Lore Sync task)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveExportUrl() {
  try {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content", "auto-managed-pages.json"), "utf-8"),
    );
    const entry = pages.find((p) => p.path === "/organizations" || p.path === "/territories");
    const sourceUrl = entry?.sourceUrl ?? "";
    const match = /\/document\/d\/([\w-]+)/.exec(sourceUrl);
    if (match) return `https://docs.google.com/document/d/${match[1]}/export?format=md`;
  } catch { /* fall through to hardcoded default */ }
  return "https://docs.google.com/document/d/1PGWzoocfjPNQ69Q-JsVmNXCFo76a3Z_IkcBuBeDj4yQ/export?format=md";
}

const EXPORT_URL = resolveExportUrl();
const contentFile = path.join(root, "content", "territories.json");

function clean(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents (Dha Chaomhnoir)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, " — ")
    .replace(/ /g, " ")
    .replaceAll("\\-", "-")
    .replaceAll("\\*", "")
    .replaceAll("*", "") // markdown bold/italic markers
    .replaceAll("&#10;", " ")
    .replace(/\s+/g, " ")
    .trim();
}

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");

// The Bathaen Empire is a collection of territories within Bathaes, not a
// region of its own — the site groups by geographic region only.
function normalizeRegion(region) {
  return region === "Bathaen Empire" ? "Bathaes" : region;
}

function parseTerritoriesTable(md) {
  const lines = md.split("\n");
  const headerIdx = lines.findIndex((l) =>
    /^\|\s*Territory\s*\|\s*Capital\s*\|\s*Region\s*\|\s*Description\s*\|/.test(l.replaceAll("*", ""))
  );
  if (headerIdx < 0) throw new Error("Territories table header not found in doc export");

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) break;
    if (/^\|[\s:|-]+\|$/.test(line)) continue; // separator row
    const cells = line.split("|").slice(1, -1).map(clean);
    if (cells.length !== 4 || !cells[0]) continue;
    rows.push({ name: cells[0], capital: cells[1], region: normalizeRegion(cells[2]), description: cells[3] });
  }
  if (rows.length < 10) throw new Error(`Territories table looks wrong (only ${rows.length} rows parsed)`);
  return rows;
}

function parseOrganizationsTable(md) {
  const lines = md.split("\n");
  const headerIdx = lines.findIndex((l) =>
    /^\|\s*Symbol\s*\|\s*Name\s*\|\s*Known For\s*\|\s*Summary\s*\|/.test(l.replaceAll("*", ""))
  );
  if (headerIdx < 0) throw new Error("Organizations table header not found in doc export");

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) break;
    if (/^\|[\s:|-]+\|$/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => clean(c.replace(/!\[\]\[[^\]]*\]/g, "")));
    if (cells.length !== 4 || !cells[1]) continue;
    rows.push({ name: cells[1], knownFor: cells[2] || null, summary: cells[3] || null });
  }
  if (rows.length < 10) throw new Error(`Organizations table looks wrong (only ${rows.length} rows parsed)`);
  return rows;
}

// Extracts each "### <Org Name>" detail section under Well Known
// Organizations into readable plain text (subheadings, bullets, rank tables).
function parseOrganizationDetails(md) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^##\s+.*Well Known Organizations/.test(l));
  if (start < 0) return new Map();

  const details = new Map(); // norm(name) -> text
  let currentName = null;
  let currentLines = [];

  const flush = () => {
    if (!currentName) return;
    const text = currentLines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (text) details.set(norm(currentName), text);
  };

  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (/^##\s/.test(raw) && !/^###/.test(raw)) break; // next major heading

    const section = raw.match(/^###\s+(.+)$/);
    if (section) {
      flush();
      currentName = clean(section[1]).replace(/,\s*The$/i, "");
      currentLines = [];
      continue;
    }
    if (!currentName) continue;

    const sub = raw.match(/^####\s+(.+)$/);
    if (sub) {
      currentLines.push("", clean(sub[1]).toUpperCase(), "");
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed.startsWith("|")) {
      if (/^\|[\s:|-]+\|$/.test(trimmed)) continue; // separator row
      const cells = trimmed.split("|").slice(1, -1).map(clean).filter(Boolean);
      if (cells.length) currentLines.push("  " + cells.join("  |  "));
      continue;
    }
    if (/^\*\s+/.test(trimmed)) {
      currentLines.push("• " + clean(trimmed.replace(/^\*\s+/, "")));
      continue;
    }
    currentLines.push(clean(raw));
  }
  flush();
  return details;
}

const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Merges doc rows into a content file. `fields` maps content keys to doc row
// keys that sync automatically; `makeNew` builds a record for new doc rows.
// Existing entries missing from the doc are kept and flagged, never deleted.
function mergeContent(label, file, docRows, fields, makeNew, changes) {
  const existing = JSON.parse(fs.readFileSync(file, "utf-8"));
  const existingByName = new Map(existing.map((t) => [norm(t.name), t]));
  const docNames = new Set(docRows.map((r) => norm(r.name)));
  const merged = [];

  for (const row of docRows) {
    const current = existingByName.get(norm(row.name));
    if (!current) {
      merged.push(makeNew(row));
      changes.push(`NEW ${label}: ${row.name} — added without image; review content/${path.basename(file)}`);
      continue;
    }
    const next = { ...current };
    for (const [key, value] of Object.entries(fields(row))) {
      if ((next[key] ?? null) !== (value ?? null)) {
        changes.push(`UPDATED ${label}: ${row.name}.${key}\n    was: ${next[key] ?? "(none)"}\n    now: ${value ?? "(none)"}`);
        next[key] = value;
      }
    }
    merged.push(next);
  }

  for (const t of existing) {
    if (!docNames.has(norm(t.name))) {
      merged.push(t);
      changes.push(`MISSING FROM DOC (${label}): ${t.name} — kept on site; remove manually if intentional`);
    }
  }

  merged.sort((a, b) => a.name.localeCompare(b.name));
  return merged;
}

const res = await fetch(EXPORT_URL, { redirect: "follow" });
if (!res.ok) throw new Error(`Doc export failed: HTTP ${res.status}`);
const md = await res.text();

const changes = [];

// ── Territories ──
const territories = mergeContent(
  "territory",
  contentFile,
  parseTerritoriesTable(md),
  (row) => ({
    capital: row.capital && row.capital.toLowerCase() !== "none" ? row.capital : null,
    region: row.region,
    description: row.description,
  }),
  (row) => ({
    id: slugify(row.name),
    name: row.name,
    capital: row.capital && row.capital.toLowerCase() !== "none" ? row.capital : null,
    region: row.region,
    description: row.description,
    image: null,
    href: null,
  }),
  changes,
);

// ── Organizations ──
// knownFor/summary/details sync from the doc; description, image, href, and
// the faction flag are site-owned and never overwritten.
const orgsFile = path.join(root, "content", "organizations.json");
const orgDetails = parseOrganizationDetails(md);
const organizations = mergeContent(
  "organization",
  orgsFile,
  parseOrganizationsTable(md),
  (row) => ({
    knownFor: row.knownFor,
    summary: row.summary,
    details: orgDetails.get(norm(row.name)) ?? null,
  }),
  (row) => ({
    id: slugify(row.name),
    name: row.name,
    knownFor: row.knownFor,
    summary: row.summary,
    details: orgDetails.get(norm(row.name)) ?? null,
    description: null,
    image: null,
    href: null,
    faction: false,
  }),
  changes,
);

const stamp = new Date().toISOString();
if (changes.length === 0) {
  console.log(`[${stamp}] Lore sync: up to date (${territories.length} territories, ${organizations.length} organizations, no changes).`);
} else {
  fs.writeFileSync(contentFile, JSON.stringify(territories, null, 2) + "\n", "utf-8");
  fs.writeFileSync(orgsFile, JSON.stringify(organizations, null, 2) + "\n", "utf-8");
  console.log(`[${stamp}] Lore sync: ${changes.length} change(s) applied:`);
  for (const c of changes) console.log("  " + c);
}
