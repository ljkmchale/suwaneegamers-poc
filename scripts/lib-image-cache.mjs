// Shared helpers for sync scripts that cache Drive images under
// apps/web/media/images.
//
// Downloads are re-encoded as WebP (quality 80, longest side capped at
// 1920px) so synced artwork stays small — see scripts/optimize-images.mjs
// for the one-time batch pass this keeps in force.
//
// Because the stored file no longer byte-matches the Drive original, the
// "skip unchanged downloads" checks in the sync scripts can't compare local
// size to Drive size. Instead each image directory gets a
// `.drive-cache.json` manifest recording the upstream size per cached file.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// sharp's fd cache makes overwriting files it has read fail on Windows
sharp.cache(false);

const MAX_DIM = 1920;
const WEBP_QUALITY = 80;
const MANIFEST_NAME = ".drive-cache.json";

function manifestPath(dir) {
  return path.join(dir, MANIFEST_NAME);
}

function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(dir), "utf8"));
  } catch {
    return {};
  }
}

function writeManifest(dir, manifest) {
  fs.writeFileSync(manifestPath(dir), JSON.stringify(manifest, null, 2));
}

/**
 * True when `basename.webp` in `dir` was produced from an upstream file of
 * `upstreamSize` bytes, so the download can be skipped.
 */
export function hasCachedImage(dir, basename, upstreamSize) {
  if (!upstreamSize) return false;
  const file = path.join(dir, `${basename}.webp`);
  if (!fs.existsSync(file)) return false;
  return readManifest(dir)[basename]?.upstreamSize === upstreamSize;
}

/**
 * Re-encode downloaded image bytes as capped WebP and store them as
 * `basename.webp` in `dir`, removing any stale sibling with another
 * extension. Records `upstreamSize` in the directory manifest for
 * hasCachedImage. Returns the filename written (`basename.webp`).
 *
 * Non-image or animated payloads (e.g. GIF) are stored verbatim under their
 * original extension via the `fallbackExtension` option.
 */
export async function saveOptimizedImage(dir, basename, bytes, upstreamSize, { fallbackExtension = "png" } = {}) {
  fs.mkdirSync(dir, { recursive: true });

  let filename;
  let output;
  try {
    const meta = await sharp(bytes).metadata();
    if ((meta.pages ?? 1) > 1) throw new Error("animated");
    output = await sharp(bytes)
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 5 })
      .toBuffer();
    filename = `${basename}.webp`;
  } catch {
    output = bytes;
    filename = `${basename}.${fallbackExtension}`;
  }

  fs.writeFileSync(path.join(dir, filename), output);

  for (const ext of ["png", "jpg", "jpeg", "gif", "webp"]) {
    const sibling = `${basename}.${ext}`;
    if (sibling === filename) continue;
    const siblingPath = path.join(dir, sibling);
    if (fs.existsSync(siblingPath)) fs.unlinkSync(siblingPath);
  }

  const manifest = readManifest(dir);
  manifest[basename] = { upstreamSize: upstreamSize ?? bytes.length };
  writeManifest(dir, manifest);

  return filename;
}
