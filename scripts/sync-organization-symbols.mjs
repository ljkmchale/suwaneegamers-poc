// Sync organization symbol PNGs from the shared Google Drive source folder.
//
// Source convention:
//   <Organization Name> - Symbol (v.0).png
//
// The script prefers the v.0 file, falls back to another Drive-hosted symbol
// PNG when needed, and removes legacy local image references for organizations
// that do not currently have a Drive symbol source.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./sync-db.mjs";
import { readContent } from "./content-documents.mjs";
import { listDriveItems, downloadDriveFile, driveDownloadDelay } from "./drive-api.mjs";

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

const driveRootFolderUrl = configuredDriveFolderUrl(
  "/organizations",
  /organization symbols/i,
  "https://drive.google.com/drive/folders/1K-Z6118llmVHHqCteN67b-G6n49edz3P",
);
const driveRootFolderId = folderIdFromUrl(driveRootFolderUrl) ?? "1K-Z6118llmVHHqCteN67b-G6n49edz3P";
const imageDir = path.join(root, "apps", "web", "public", "images", "organizations");

const folderNameAliases = new Map([
  ["peragontear", "paragontear"],
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
  return folderNameAliases.get(key) ?? key;
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

function pickSymbolFile(folderName, files) {
  const pngSymbols = files.filter((file) =>
    / - Symbol \(v\.[^)]+\)\.png$/i.test(file.title)
    || / - Symbol \(v\.[^)]+ - \d+p\)\.png$/i.test(file.title)
  );
  const exact = pngSymbols.find((file) => / - Symbol \(v\.0\)\.png$/i.test(file.title));
  if (exact) return { file: exact, exact: true };

  const folderKey = canonicalNorm(folderName);
  const matchingName = pngSymbols.find((file) => canonicalNorm(file.title.split(" - Symbol ")[0] ?? "") === folderKey);
  if (matchingName) return { file: matchingName, exact: false };

  return pngSymbols[0] ? { file: pngSymbols[0], exact: false } : null;
}

async function tryDownloadPng(fileId, destination) {
  try {
    await driveDownloadDelay();
    const bytes = await downloadDriveFile(fileId);
    const isPng = bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50
      && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a
      && bytes[6] === 0x1a && bytes[7] === 0x0a;
    if (!isPng) return false;
    fs.writeFileSync(destination, bytes);
    return true;
  } catch {
    return false;
  }
}

const db = getDb();
const organizations = db.prepare(`SELECT id, name, image FROM organizations ORDER BY rowid`).all();
fs.mkdirSync(imageDir, { recursive: true });

const rootRaw = await listDriveItems(driveRootFolderId);
const folderByName = new Map(
  rootRaw.map((f) => [canonicalNorm(f.name), { id: f.id, title: f.name }]),
);

const changes = [];
const warnings = [];

for (const organization of organizations) {
  const folder = folderByName.get(canonicalNorm(organization.name));
  if (!folder) {
    if (organization.image) {
      changes.push(`${organization.name}: cleared legacy image because no Drive symbol folder was found`);
      organization.image = null;
    }
    warnings.push(`${organization.name}: no folder found in Drive source`);
    continue;
  }

  const subRaw = await listDriveItems(folder.id);
  const files = subRaw.map((f) => ({ id: f.id, title: f.name }));
  const picked = pickSymbolFile(folder.title, files);
  if (!picked) {
    if (organization.image) {
      changes.push(`${organization.name}: cleared legacy image because no Drive symbol PNG was found`);
      organization.image = null;
    }
    warnings.push(`${organization.name}: no symbol PNG found in ${folder.title}`);
    continue;
  }

  const filename = `${slugify(organization.name)}-symbol.png`;
  const destination = path.join(imageDir, filename);
  const downloaded = await tryDownloadPng(picked.file.id, destination);

  if (!downloaded) {
    warnings.push(`${organization.name}: Drive blocked unauthenticated PNG download for ${picked.file.title}; keeping existing local cache`);
    continue;
  }

  const imagePath = `/images/organizations/${filename}`;
  if (organization.image !== imagePath) {
    changes.push(`${organization.name}: ${organization.image ?? "(none)"} -> ${imagePath}`);
    organization.image = imagePath;
  }
  if (!picked.exact) {
    warnings.push(`${organization.name}: using fallback ${picked.file.title}; add ${organization.name} - Symbol (v.0).png when ready`);
  }
}

const updateImage = db.prepare(`UPDATE organizations SET image = ? WHERE id = ?`);
db.transaction(() => {
  for (const org of organizations) {
    updateImage.run(org.image ?? null, org.id);
  }
})();

const stamp = new Date().toISOString();
console.log(`[${stamp}] Organization symbols synced from Drive folder ${driveRootFolderId}`);
console.log(`Downloaded/verified ${organizations.filter((org) => org.image?.includes("/images/organizations/")).length} organization symbol reference(s).`);

if (changes.length) {
  console.log("Changes:");
  for (const change of changes) console.log(`  ${change}`);
} else {
  console.log("No organization image field changes.");
}

if (warnings.length) {
  console.log("Warnings:");
  for (const warning of warnings) console.log(`  ${warning}`);
}
