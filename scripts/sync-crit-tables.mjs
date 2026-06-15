// Sync Critical Tables content from the DM Reference Google Doc.
// Parses Critical Success, Critical Failure, and Body Hit tables
// and updates content/page-layouts/crit_tables.json.
//
// Run manually:  node scripts/sync-crit-tables.mjs
// Scheduled:     scripts/sync-lore.cmd
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const layoutFile = path.join(root, "content", "page-layouts", "crit_tables.json");
const autoManagedPagesFile = path.join(root, "content", "auto-managed-pages.json");

function resolveDocExportUrl() {
  try {
    const pages = JSON.parse(fs.readFileSync(autoManagedPagesFile, "utf-8"));
    const entry = pages.find((p) => p.path === "/crit_tables");
    const match = /\/document\/d\/([\w-]+)/.exec(entry?.sourceUrl ?? "");
    if (match) return `https://docs.google.com/document/d/${match[1]}/export?format=md`;
  } catch { /* fall through */ }
  return "https://docs.google.com/document/d/1eODEiSco7IhOJw_kJW92YqTJDdYO9IfG_tnnXfYUY80/export?format=md";
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed for ${url}: HTTP ${res.status}`);
  return res.text();
}

function clean(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/—/g, " — ")
    .replace(/ /g, " ")
    .replaceAll("\\-", "-")
    .replaceAll("\\*", "")
    .replaceAll("*", "")
    .replaceAll("&#10;", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMarkdownTable(lines, startIndex) {
  const headerLine = lines[startIndex];
  if (!headerLine?.startsWith("|")) return null;

  const separatorLine = lines[startIndex + 1];
  if (!separatorLine || !/^\|[\s|:-]+\|/.test(separatorLine)) return null;

  const headers = headerLine
    .split("|")
    .slice(1, -1)
    .map((c) => clean(c));

  const rows = [];
  for (let i = startIndex + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    const cols = line.split("|").slice(1, -1).map((c) => clean(c));
    if (cols.some((c) => c)) rows.push(cols);
  }

  return { headers, rows };
}

function findTableAfterHeading(lines, headingPattern) {
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i]) && headingPattern.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        if (lines[j].startsWith("|")) {
          return parseMarkdownTable(lines, j);
        }
      }
    }
  }
  return null;
}

function rowsToString(rows) {
  return rows.map((r) => r.join(" | ")).join("\n");
}

const md = await fetchText(resolveDocExportUrl());
const lines = md.split("\n");

const critSuccessTable = findTableAfterHeading(lines, /critical\s+success/i);
const critFailureTable = findTableAfterHeading(lines, /critical\s+fail/i);
const bodyHitTable = findTableAfterHeading(lines, /body\s+hit/i);

const layout = JSON.parse(fs.readFileSync(layoutFile, "utf-8"));
const changes = [];
const warnings = [];

function updateTableBlock(blockId, table) {
  if (!table) {
    warnings.push(`${blockId}: table not found in source doc — block left unchanged`);
    return;
  }
  if (!table.rows.length) {
    warnings.push(`${blockId}: table found but no data rows parsed — block left unchanged`);
    return;
  }
  const block = layout.find((b) => b.id === blockId);
  if (!block) {
    warnings.push(`${blockId}: block not found in layout`);
    return;
  }

  const newRows = rowsToString(table.rows);
  if (block.props.rows !== newRows) {
    changes.push(`${blockId}: updated (${table.rows.length} rows)`);
    block.props.rows = newRows;
  }
}

updateTableBlock("crit-tables-success", critSuccessTable);
updateTableBlock("crit-tables-failure", critFailureTable);
updateTableBlock("crit-tables-body-hits", bodyHitTable);

const stamp = new Date().toISOString();

if (changes.length) {
  fs.writeFileSync(layoutFile, JSON.stringify(layout, null, 2) + "\n", "utf-8");
  console.log(`[${stamp}] Crit tables layout updated.`);
  console.log("Changes:");
  for (const change of changes) console.log(`  ${change}`);
} else {
  console.log(`[${stamp}] Crit tables: no changes.`);
}

if (warnings.length) {
  console.log("Warnings:");
  for (const warning of warnings) console.log(`  ${warning}`);
}
