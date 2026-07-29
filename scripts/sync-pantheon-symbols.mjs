// Sync Pantheon deity symbol PNGs from the shared Google Drive source folder.
//
// Source convention:
//   <Deity Name> - Symbol (v.0).png
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readContent, writeContent } from "./content-documents.mjs";
import { listDriveItems, downloadDriveFile, driveDownloadDelay } from "./drive-api.mjs";
import { hasCachedImage, saveOptimizedImage } from "./lib-image-cache.mjs";

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
  "/pantheon",
  /deity symbols/i,
  "https://drive.google.com/drive/folders/14mCaYtQov1JyQASn9HQ82PeoMI8y1ylI",
);
const driveFolderId = folderIdFromUrl(driveFolderUrl) ?? "14mCaYtQov1JyQASn9HQ82PeoMI8y1ylI";
const imageDir = path.join(root, "apps", "web", "media", "images", "pantheon");

const driveNameAliases = new Map([
  ["valari", "villari"],
]);

const localImageAliases = new Map([
  ["oneeye", "oneeye"],
]);

function norm(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function canonicalNorm(value) {
  const key = norm(value);
  return driveNameAliases.get(key) ?? key;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getDeityName(block) {
  const title = block.props?.title ?? "";
  return title.split(/\s+[—-]\s+/u)[0].trim();
}

function getSymbolName(title) {
  return title.split(" - Symbol ")[0]?.trim() ?? title;
}

async function tryDownloadPngBytes(fileId) {
  try {
    await driveDownloadDelay();
    const bytes = await downloadDriveFile(fileId);
    const isPng = bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50
      && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a
      && bytes[6] === 0x1a && bytes[7] === 0x0a;
    if (!isPng) return null;
    return bytes;
  } catch {
    return null;
  }
}

const layout = readContent("page-layouts/pantheon.json");
fs.mkdirSync(imageDir, { recursive: true });

const rawItems = await listDriveItems(driveFolderId);
const driveItems = rawItems
  .map((f) => ({ id: f.id, title: f.name, size: Number(f.size ?? 0) }))
  .filter((item) => / - Symbol \(v\.0\)\.png$/i.test(item.title));

const symbolByName = new Map(
  driveItems.map((item) => [canonicalNorm(getSymbolName(item.title)), item]),
);

const deityBlocks = layout.filter((block) => block.type === "deity-card");
const changes = [];
const warnings = [];

for (const block of deityBlocks) {
  const deityName = getDeityName(block);
  const symbol = symbolByName.get(canonicalNorm(deityName));

  if (!symbol) {
    warnings.push(`${deityName}: no ${deityName} - Symbol (v.0).png found in Drive source`);
    continue;
  }

  const basename = `${slugify(deityName)}-symbol`;
  const legacyPng = path.join(imageDir, `${basename}.png`);

  // Drive's abuse limiter slow-403s bulk API-key downloads, so skip files
  // whose cached copy was built from the size Drive reports in the listing
  // (tracked in the directory manifest — cached files are re-encoded WebP).
  let filename = null;
  if (hasCachedImage(imageDir, basename, symbol.size)) {
    filename = `${basename}.webp`;
  } else if (symbol.size > 0 && fs.existsSync(legacyPng) && fs.statSync(legacyPng).size === symbol.size) {
    // legacy raw-PNG cache still matches Drive: re-encode locally, no download
    filename = await saveOptimizedImage(imageDir, basename, fs.readFileSync(legacyPng), symbol.size);
  } else {
    const bytes = await tryDownloadPngBytes(symbol.id);
    if (bytes) filename = await saveOptimizedImage(imageDir, basename, bytes, symbol.size);
  }
  const downloaded = Boolean(filename);

  // Resolve image path: prefer the cached symbol, then an already-present
  // local copy, then the webp fallback, then the symbol path as a last resort.
  const fallbackSlug = localImageAliases.get(canonicalNorm(deityName)) ?? slugify(deityName);
  const fallbackFilename = `${fallbackSlug}.webp`;
  const fallbackPath = path.join(imageDir, fallbackFilename);
  const localCopy = ["webp", "png"].find((ext) => fs.existsSync(path.join(imageDir, `${basename}.${ext}`)));
  const imagePath = downloaded
    ? `/images/pantheon/${filename}`
    : localCopy
      ? `/images/pantheon/${basename}.${localCopy}`
      : fs.existsSync(fallbackPath)
        ? `/images/pantheon/${fallbackFilename}`
        : `/images/pantheon/${basename}.webp`;
  if (block.props.image !== imagePath) {
    changes.push(`${deityName}: ${block.props.image ?? "(none)"} -> ${imagePath}`);
    block.props.image = imagePath;
  }
  block.props.imageSourceFolder = driveFolderId;
  block.props.imageSourceFileId = symbol.id;
  block.props.imageSourceFileName = symbol.title;
  if (!downloaded) {
    warnings.push(`${deityName}: verified Drive source ${symbol.title}, but Drive blocked unauthenticated PNG download; keeping existing local cache`);
  }
}

writeContent("page-layouts/pantheon.json", layout);

const stamp = new Date().toISOString();
const syncedCount = deityBlocks.filter((block) => block.props.imageSourceFolder === driveFolderId).length;

console.log(`[${stamp}] Pantheon symbols synced from Drive folder ${driveFolderId}`);
console.log(`Downloaded/verified ${syncedCount} pantheon symbol reference(s).`);

if (changes.length) {
  console.log("Changes:");
  for (const change of changes) console.log(`  ${change}`);
} else {
  console.log("No pantheon image field changes.");
}

if (warnings.length) {
  console.log("Warnings:");
  for (const warning of warnings) console.log(`  ${warning}`);
}
