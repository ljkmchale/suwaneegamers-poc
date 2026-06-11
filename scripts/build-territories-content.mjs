// One-off: merge the Google Doc territories table with image/link data
// from the old block layout into content/territories.json.
import fs from "fs";
import path from "path";
import os from "os";

const root = process.cwd();
const docText = fs.readFileSync(path.join(os.tmpdir(), "lore-doc.txt"), "utf-8");

// ── Fix UTF-8 mojibake from the doc export ──
function clean(s) {
  return s
    .replaceAll("â€™", "'")   // ’
    .replaceAll("â€œ", '"')   // “
    .replaceAll("â€", '"')   // ”
    .replaceAll("â€”", " — ") // —
    .replaceAll("â€“", "–")   // –
    .replaceAll("â€", '"')
    .replace(/DhaÌ? ChaomhnoÌ?ir/g, "Dha Chaomhnoir")
    .replace(/DhaIÌ€?/g, "Dha")
    .replaceAll("\\'", "'")
    .replaceAll("\\*", "")
    .replaceAll("&#10;", " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Parse the Territories table from the doc ──
const lines = docText.split("\n");
const startIdx = lines.findIndex((l) => l.includes("### \\*\\*Territories\\*\\*") || l.includes("### **Territories**"));
if (startIdx < 0) throw new Error("Territories heading not found");

const rows = [];
for (let i = startIdx; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith("## ")) break; // next major heading (Glossary)
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").map((c) => clean(c)).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
  if (cells.length !== 4) continue;
  if (!cells[0] || cells[0] === "Territory" || cells[0] === ":-:") continue;
  rows.push({ name: cells[0], capital: cells[1], region: cells[2], description: cells[3] });
}

// ── Pull image + href per territory from the old layout ──
const layout = JSON.parse(fs.readFileSync(path.join(root, "content/page-layouts/territories.json"), "utf-8"));
const layoutItems = Array.isArray(layout) ? layout : layout.items;
const found = []; // {title, image, href}
function walk(node) {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== "object") return;
  if (node.type === "inner-card" && node.props) {
    let items = node.props.items;
    if (typeof items === "string") { try { items = JSON.parse(items); } catch { items = []; } }
    const img = items.find((x) => x.type === "image")?.props?.src;
    const title = items.find((x) => x.type === "header")?.props?.title;
    const href = items.find((x) => x.type === "link")?.props?.href;
    if (title) found.push({ title: clean(title), image: img, href });
    return;
  }
  for (const v of Object.values(node)) {
    if (typeof v === "string" && v.trim().startsWith("[")) {
      try { walk(JSON.parse(v)); } catch { /* not JSON */ }
    } else if (typeof v === "object") walk(v);
  }
}
walk(layoutItems);

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const byName = new Map(found.map((f) => [norm(f.title), f]));

const territories = rows.map((r) => {
  const match = byName.get(norm(r.name));
  const id = r.name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    id,
    name: r.name,
    capital: r.capital && r.capital.toLowerCase() !== "none" ? r.capital : null,
    region: r.region,
    description: r.description,
    image: match?.image ?? null,
    href: match?.href ?? null,
  };
});

territories.sort((a, b) => a.name.localeCompare(b.name));

console.log(`Doc rows: ${rows.length}, layout cards: ${found.length}`);
const unmatchedDoc = territories.filter((t) => !t.image).map((t) => t.name);
const unmatchedLayout = found.filter((f) => !rows.some((r) => norm(r.name) === norm(f.title))).map((f) => f.title);
console.log("Doc territories without layout match:", unmatchedDoc.join(", ") || "none");
console.log("Layout cards not in doc:", unmatchedLayout.join(", ") || "none");

fs.writeFileSync(path.join(root, "content/territories.json"), JSON.stringify(territories, null, 2) + "\n", "utf-8");
console.log(`Wrote content/territories.json with ${territories.length} territories`);
