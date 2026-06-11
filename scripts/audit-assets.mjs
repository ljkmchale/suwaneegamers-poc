// One-off asset audit: finds broken /images/ references in content JSON,
// orphaned files on disk, and oversized assets.
import fs from "fs";
import path from "path";

const root = process.cwd();
const contentDir = path.join(root, "content");
const publicDir = path.join(root, "apps", "web", "public");
const imagesDir = path.join(publicDir, "images");

function walk(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p, filter);
    return filter(p) ? [p] : [];
  });
}

// 1. Gather all /images/... references from content JSON
const refs = new Map(); // ref -> [files]
const jsonFiles = walk(contentDir, (p) => p.endsWith(".json"));
const refRe = /"(\/images\/[^"]+?)"/g;
for (const f of jsonFiles) {
  const text = fs.readFileSync(f, "utf-8");
  for (const m of text.matchAll(refRe)) {
    const ref = m[1];
    if (!refs.has(ref)) refs.set(ref, []);
    refs.get(ref).push(path.relative(root, f));
  }
}

// 2. Check each ref resolves to a file on disk
const broken = [];
for (const [ref, sources] of refs) {
  const cleanRef = ref.split(/[?#]/)[0];
  const abs = path.join(publicDir, decodeURIComponent(cleanRef));
  if (!fs.existsSync(abs)) broken.push({ ref, sources: [...new Set(sources)] });
}

// 3. Files on disk not referenced anywhere in content JSON
const allFiles = walk(imagesDir, () => true);
const refSet = new Set([...refs.keys()].map((r) => decodeURIComponent(r.split(/[?#]/)[0]).toLowerCase()));
const orphans = [];
for (const f of allFiles) {
  const rel = "/" + path.relative(publicDir, f).replaceAll("\\", "/");
  if (!refSet.has(rel.toLowerCase())) orphans.push({ rel, size: fs.statSync(f).size });
}

// 4. Oversized referenced assets (>500KB)
const big = [];
for (const ref of refs.keys()) {
  const abs = path.join(publicDir, decodeURIComponent(ref.split(/[?#]/)[0]));
  if (fs.existsSync(abs)) {
    const size = fs.statSync(abs).size;
    if (size > 500 * 1024) big.push({ ref, size });
  }
}

// 5. Referenced paths with characters that need URL encoding
const odd = [...refs.keys()].filter((r) => /[ ,()]/.test(r));

const fmt = (b) => (b / 1024 / 1024).toFixed(2) + " MB";
console.log(`Scanned ${jsonFiles.length} JSON files, ${refs.size} unique image refs, ${allFiles.length} files on disk.\n`);
console.log("=== BROKEN REFERENCES (referenced but missing on disk) ===");
broken.forEach((b) => console.log(`  ${b.ref}\n    used in: ${b.sources.join(", ")}`));
if (!broken.length) console.log("  none");
console.log("\n=== REFS WITH SPACES/SPECIAL CHARS ===");
odd.forEach((r) => console.log(`  ${r}`));
if (!odd.length) console.log("  none");
console.log("\n=== LARGE REFERENCED ASSETS (>500 KB) ===");
big.sort((a, b) => b.size - a.size).forEach((b) => console.log(`  ${fmt(b.size).padStart(9)}  ${b.ref}`));
if (!big.length) console.log("  none");
console.log("\n=== ORPHANS (on disk, not referenced in content JSON) ===");
orphans.sort((a, b) => b.size - a.size).forEach((o) => console.log(`  ${fmt(o.size).padStart(9)}  ${o.rel}`));
if (!orphans.length) console.log("  none");
