// Sync the Reference for Dungeon Masters cover image from the shared Google Drive folder.
// Downloads the latest versioned cover image to:
//   apps/web/media/images/guides-to-myrdae/dm-reference.{ext}
//
// Source convention:
//   Reference for Dungeon Masters - Cover (v.YY.MM.DD).jpg
//
// Run manually:  node scripts/sync-dm-reference.mjs
// Scheduled:     scripts/sync-lore.cmd
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readContent, writeContent } from "./content-documents.mjs";
import { listDriveItems, downloadDriveFile } from "./drive-api.mjs";
import { saveOptimizedImage } from "./lib-image-cache.mjs";

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
  "/reference-for-dungeon-masters",
  /dm.reference|dungeon.master/i,
  "https://drive.google.com/drive/folders/198sTv45Mur0RuvA6Ma8DPv-f9NIC0QCk",
);
const driveFolderId = folderIdFromUrl(driveFolderUrl) ?? "198sTv45Mur0RuvA6Ma8DPv-f9NIC0QCk";
const imageDir = path.join(root, "apps", "web", "media", "images", "guides-to-myrdae");

function isCoverImage(title) {
  return /^Reference for Dungeon Masters\s*-\s*Cover\s*\(v\.[^)]+\)\.(jpe?g|png)$/i.test(title);
}

function extensionFor(title, bytes) {
  const fromName = title.match(/\.(jpe?g|png)$/i)?.[1]?.toLowerCase();
  if (fromName) return fromName === "jpeg" ? "jpg" : fromName;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  return "jpg";
}

const rawItems = await listDriveItems(driveFolderId);
const cover = rawItems.map((f) => ({ id: f.id, title: f.name })).find((item) => isCoverImage(item.title));

const stamp = new Date().toISOString();

if (!cover) {
  console.warn(`[${stamp}] No cover image found in DM Reference Drive folder (${driveFolderId}).`);
  console.warn(`  Expected a file matching: Reference for Dungeon Masters - Cover (v.YY.MM.DD).jpg`);
} else {
  // Read existing tracked file ID to skip unnecessary re-downloads
  const pages = readContent("auto-managed-pages.json");
  const pageEntry = pages.find((p) => p.path === "/reference-for-dungeon-masters");
  const previousFileId = pageEntry?.coverImageSourceFileId;

  if (previousFileId === cover.id) {
    console.log(`[${stamp}] DM Reference cover image unchanged (${cover.title}). No download needed.`);
  } else {
    const bytes = await downloadDriveFile(cover.id);
    const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isPng && !isJpeg) throw new Error(`Drive file ${cover.id} did not download as a PNG/JPG`);

    // Saved as dm-reference.webp — page layouts reference that path directly.
    const ext = extensionFor(cover.title, bytes);
    const filename = await saveOptimizedImage(imageDir, "dm-reference", bytes, bytes.length, {
      fallbackExtension: ext,
    });

    // Track source file ID so we don't re-download the same version
    if (pageEntry) {
      pageEntry.coverImageSourceFileId = cover.id;
      pageEntry.coverImageSourceFileName = cover.title;
      writeContent("auto-managed-pages.json", pages);
    }

    const prev = previousFileId ? `(was: ${previousFileId})` : "(first download)";
    console.log(`[${stamp}] DM Reference cover image updated: ${cover.title} ${prev}`);
    console.log(`  Saved to: /media/images/guides-to-myrdae/${filename}`);
  }
}
