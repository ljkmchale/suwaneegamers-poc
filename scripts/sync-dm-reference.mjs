// Sync the Reference for Dungeon Masters cover image from the shared Google Drive folder.
// Downloads the latest versioned cover image to:
//   apps/web/public/images/guides-to-myrdae/dm-reference.{ext}
//
// Source convention:
//   Reference for Dungeon Masters - Cover (v.YY.MM.DD).jpg
//
// Run manually:  node scripts/sync-dm-reference.mjs
// Scheduled:     scripts/sync-lore.cmd
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const driveFolderUrl = "https://drive.google.com/drive/folders/198sTv45Mur0RuvA6Ma8DPv-f9NIC0QCk";
const driveFolderId = "198sTv45Mur0RuvA6Ma8DPv-f9NIC0QCk";
const imageDir = path.join(root, "apps", "web", "public", "images", "guides-to-myrdae");
const autoManagedPagesFile = path.join(root, "content", "auto-managed-pages.json");

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

function isCoverImage(title) {
  return /^Reference for Dungeon Masters\s*-\s*Cover\s*\(v\.[^)]+\)\.(jpe?g|png)$/i.test(title);
}

function extensionFor(title, bytes) {
  const fromName = title.match(/\.(jpe?g|png)$/i)?.[1]?.toLowerCase();
  if (fromName) return fromName === "jpeg" ? "jpg" : fromName;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  return "jpg";
}

const html = await fetchText(driveFolderUrl);
const items = parseDriveItems(html);
const cover = items.find((item) => isCoverImage(item.title));

const stamp = new Date().toISOString();

if (!cover) {
  console.warn(`[${stamp}] No cover image found in DM Reference Drive folder (${driveFolderId}).`);
  console.warn(`  Expected a file matching: Reference for Dungeon Masters - Cover (v.YY.MM.DD).jpg`);
  process.exit(0);
}

// Read existing tracked file ID to skip unnecessary re-downloads
const pages = JSON.parse(fs.readFileSync(autoManagedPagesFile, "utf-8"));
const pageEntry = pages.find((p) => p.path === "/reference-for-dungeon-masters");
const previousFileId = pageEntry?.coverImageSourceFileId;

if (previousFileId === cover.id) {
  console.log(`[${stamp}] DM Reference cover image unchanged (${cover.title}). No download needed.`);
  process.exit(0);
}

const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(cover.id)}`;
const res = await fetch(downloadUrl, { redirect: "follow" });
if (!res.ok) throw new Error(`Download failed for ${cover.id}: HTTP ${res.status}`);

const bytes = Buffer.from(await res.arrayBuffer());
const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
if (!isPng && !isJpeg) throw new Error(`Drive file ${cover.id} did not download as a PNG/JPG`);

const ext = extensionFor(cover.title, bytes);
fs.mkdirSync(imageDir, { recursive: true });
fs.writeFileSync(path.join(imageDir, `dm-reference.${ext}`), bytes);

// Track source file ID so we don't re-download the same version
if (pageEntry) {
  pageEntry.coverImageSourceFileId = cover.id;
  pageEntry.coverImageSourceFileName = cover.title;
  fs.writeFileSync(autoManagedPagesFile, JSON.stringify(pages, null, 2) + "\n", "utf-8");
}

const prev = previousFileId ? `(was: ${previousFileId})` : "(first download)";
console.log(`[${stamp}] DM Reference cover image updated: ${cover.title} ${prev}`);
console.log(`  Saved to: /images/guides-to-myrdae/dm-reference.${ext}`);
