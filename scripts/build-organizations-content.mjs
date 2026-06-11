// One-off: merge the lore doc's "Well Known Organizations" table with
// image/link/description data from the old block layout into
// content/organizations.json.
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const md = fs.readFileSync(path.join(os.tmpdir(), "lore-doc.md"), "utf-8");

// The doc names these five as the organizations that heavily recruit
// adventurers ("factions").
const FACTIONS = new Set([
  "advents-of-harmony",
  "cloak-of-defiance",
  "everdawn",
  "meridian",
  "tegenwald-phet",
]);

function clean(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, " — ")
    .replace(/ /g, " ")
    .replace(/!\[\]\[[^\]]*\]/g, "") // markdown image refs in the Symbol column
    .replaceAll("\\-", "-")
    .replaceAll("\\*", "")
    .replaceAll("*", "")
    .replaceAll("&#10;", " ")
    .replace(/\s+/g, " ")
    .trim();
}

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ── Parse the Well Known Organizations table ──
const lines = md.split("\n");
const headerIdx = lines.findIndex((l) =>
  /^\|\s*Symbol\s*\|\s*Name\s*\|\s*Known For\s*\|\s*Summary\s*\|/.test(l.replaceAll("*", ""))
);
if (headerIdx < 0) throw new Error("Organizations table header not found");

const rows = [];
for (let i = headerIdx + 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line.startsWith("|")) break;
  if (/^\|[\s:|-]+\|$/.test(line)) continue;
  const cells = line.split("|").slice(1, -1).map(clean);
  if (cells.length !== 4 || !cells[1]) continue;
  rows.push({ name: cells[1], knownFor: cells[2] || null, summary: cells[3] || null });
}
console.log(`Doc rows: ${rows.length}`);

// ── Pull image / href / curated description from the old layout ──
const layout = JSON.parse(fs.readFileSync(path.join(root, "content/page-layouts/organizations.json"), "utf-8"));
const layoutItems = Array.isArray(layout) ? layout : layout.items;
const cards = layoutItems
  .filter((i) => i.type === "card" && i.props?.title)
  .map((c) => ({
    title: clean(String(c.props.title)),
    image: c.props.image ?? null,
    href: c.props.href ?? null,
    description: c.props.description ? clean(String(c.props.description)) : null,
  }));
console.log(`Layout cards: ${cards.length}`);
const cardByName = new Map(cards.map((c) => [norm(c.title), c]));

const organizations = rows.map((row) => {
  const card = cardByName.get(norm(row.name));
  const id = slug(row.name);
  return {
    id,
    name: row.name,
    knownFor: row.knownFor,
    summary: row.summary,
    description: card?.description ?? null,
    image: card?.image ?? null,
    href: card?.href ?? null,
    faction: FACTIONS.has(id),
  };
});

organizations.sort((a, b) => a.name.localeCompare(b.name));

const unmatchedDoc = organizations.filter((o) => !cardByName.has(norm(o.name))).map((o) => o.name);
const unmatchedCards = cards.filter((c) => !rows.some((r) => norm(r.name) === norm(c.title))).map((c) => c.title);
console.log("Doc orgs without layout card:", unmatchedDoc.join(", ") || "none");
console.log("Layout cards not in doc:", unmatchedCards.join(", ") || "none");
console.log("Factions:", organizations.filter((o) => o.faction).map((o) => o.name).join(", "));

fs.writeFileSync(path.join(root, "content/organizations.json"), JSON.stringify(organizations, null, 2) + "\n", "utf-8");
console.log(`Wrote content/organizations.json with ${organizations.length} organizations`);
