// Batch-optimize apps/web/media/images and rewrite references.
//
// - PNG/JPG over SIZE_THRESHOLD bytes are re-encoded as WebP (quality 80),
//   capped at MAX_DIM px on the longest side. Originals are deleted and every
//   reference in content/ and apps/web source is rewritten to the new .webp path.
// - Oversized/overweight WebP files are re-encoded in place (same path).
// - SVG/GIF/ICO and animated images are skipped.
//
// Usage:
//   node scripts/optimize-images.mjs --dry-run   # report what would change
//   node scripts/optimize-images.mjs             # apply
//
// After applying, run `pnpm content:sync-documents` so the SQLite
// content_documents rows pick up the rewritten JSON.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// keep sharp from holding input file handles open — on Windows that makes
// overwriting the same file (recompress in place) fail with EUNKNOWN
sharp.cache(false);

const DRY_RUN = process.argv.includes("--dry-run");
const root = process.cwd();
const imageDir = path.join(root, "apps", "web", "media", "images");

const SIZE_THRESHOLD = 150 * 1024; // only touch files bigger than this
const MAX_DIM = 1920; // cap longest side
const WEBP_QUALITY = 80;
// keep the original when re-encoding saves less than this fraction
const MIN_SAVINGS = 0.1;

// files that must keep their current format (e.g. apple-touch-icon needs PNG)
const EXCLUDE = new Set(["/media/images/suwaneegamers-logo.png"]);

const REFERENCE_DIRS = [
  { dir: path.join(root, "content"), exts: [".json"] },
  { dir: path.join(root, "apps", "web", "app"), exts: [".ts", ".tsx"] },
  { dir: path.join(root, "apps", "web", "components"), exts: [".ts", ".tsx"] },
  { dir: path.join(root, "apps", "web", "lib"), exts: [".ts", ".tsx"] },
];

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const fmtKB = (b) => `${Math.round(b / 1024)}KB`;

// ---------------------------------------------------------------------------
// Pass 1: re-encode images
// ---------------------------------------------------------------------------

const renames = []; // { from: "/media/images/x.png", to: "/media/images/x.webp" }
let beforeTotal = 0;
let afterTotal = 0;
let converted = 0;
let recompressed = 0;
let skipped = 0;

for await (const file of walk(imageDir)) {
  const ext = path.extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) continue;

  const relPath = "/media/images/" + path.relative(imageDir, file).split(path.sep).join("/");
  if (EXCLUDE.has(relPath)) continue;

  const stat = await fs.stat(file);
  if (stat.size < SIZE_THRESHOLD) continue;

  let meta;
  try {
    meta = await sharp(file).metadata();
  } catch (err) {
    console.warn(`SKIP (unreadable): ${file}: ${err.message}`);
    continue;
  }
  if ((meta.pages ?? 1) > 1) {
    skipped++;
    continue; // animated
  }

  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  let pipeline = sharp(file);
  if (longest > MAX_DIM) {
    pipeline = pipeline.resize({
      width: MAX_DIM,
      height: MAX_DIM,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const buffer = await pipeline
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toBuffer();

  if (buffer.length >= stat.size * (1 - MIN_SAVINGS)) {
    skipped++;
    continue; // not worth it
  }

  const isWebp = ext === ".webp";
  let target = isWebp
    ? file
    : file.slice(0, -ext.length) + ".webp";

  if (!isWebp) {
    // name collision: a sibling .webp already exists — re-encode in place
    // under the original extension instead of clobbering the other file.
    try {
      await fs.access(target);
      console.warn(`COLLISION: ${path.basename(target)} exists; leaving ${path.basename(file)} untouched`);
      skipped++;
      continue;
    } catch {
      // no collision
    }
  }

  beforeTotal += stat.size;
  afterTotal += buffer.length;

  const rel = "/media/images/" + path.relative(imageDir, file).split(path.sep).join("/");
  const relTarget = "/media/images/" + path.relative(imageDir, target).split(path.sep).join("/");

  if (DRY_RUN) {
    console.log(`${isWebp ? "recompress" : "convert"}  ${rel} -> ${relTarget}  ${fmtKB(stat.size)} -> ${fmtKB(buffer.length)}${longest > MAX_DIM ? ` (resize ${meta.width}x${meta.height})` : ""}`);
  } else {
    try {
      await fs.writeFile(target, buffer);
      if (!isWebp) await fs.unlink(file);
    } catch (err) {
      console.warn(`WRITE FAILED (skipping): ${rel}: ${err.message}`);
      beforeTotal -= stat.size;
      afterTotal -= buffer.length;
      skipped++;
      continue;
    }
  }

  if (isWebp) recompressed++;
  else {
    converted++;
    renames.push({ from: rel, to: relTarget });
  }
}

console.log(`\nimages: ${converted} converted to webp, ${recompressed} recompressed in place, ${skipped} skipped`);
console.log(`size: ${fmtKB(beforeTotal)} -> ${fmtKB(afterTotal)} (saved ${fmtKB(beforeTotal - afterTotal)})`);

// ---------------------------------------------------------------------------
// Pass 2: rewrite references to renamed files
// ---------------------------------------------------------------------------

if (renames.length > 0) {
  let filesChanged = 0;
  let totalReplacements = 0;

  for (const { dir, exts } of REFERENCE_DIRS) {
    for await (const file of walk(dir)) {
      if (!exts.includes(path.extname(file).toLowerCase())) continue;
      const original = await fs.readFile(file, "utf8");
      let updated = original;
      for (const { from, to } of renames) {
        updated = updated.split(from).join(to);
      }
      if (updated !== original) {
        filesChanged++;
        totalReplacements += renames.filter(({ from }) => original.includes(from)).length;
        if (DRY_RUN) {
          console.log(`would rewrite: ${path.relative(root, file)}`);
        } else {
          await fs.writeFile(file, updated, "utf8");
        }
      }
    }
  }
  console.log(`references: ${totalReplacements} path(s) rewritten across ${filesChanged} file(s)`);

  // Anything still pointing at a deleted original, anywhere obvious?
  if (!DRY_RUN) {
    const mapPath = path.join(root, "scripts", "optimize-images.map.json");
    await fs.writeFile(mapPath, JSON.stringify(renames, null, 2));
    console.log(`rename map written to ${path.relative(root, mapPath)}`);
  }
}
