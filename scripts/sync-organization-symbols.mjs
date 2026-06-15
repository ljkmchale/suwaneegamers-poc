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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const driveRootFolderUrl = "https://drive.google.com/drive/folders/1K-Z6118llmVHHqCteN67b-G6n49edz3P?usp=sharing";
const driveRootFolderId = "1K-Z6118llmVHHqCteN67b-G6n49edz3P";
const orgsFile = path.join(root, "content", "organizations.json");
const imageDir = path.join(root, "apps", "web", "public", "images", "organizations");

const folderNameAliases = new Map([
  ["peragontear", "paragontear"],
]);

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
  return title
    .replace(/ Shared folder$/i, "")
    .replace(/ Image$/i, "")
    .trim();
}

function norm(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

async function fetchDriveFolderItems(folderId) {
  const html = await fetchText(`https://drive.google.com/drive/folders/${folderId}`);
  return parseDriveItems(html);
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

async function downloadPng(fileId, destination) {
  const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed for ${fileId}: HTTP ${res.status}`);

  const bytes = Buffer.from(await res.arrayBuffer());
  const isPng = bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a;
  if (!isPng) throw new Error(`Drive file ${fileId} did not download as a PNG`);

  fs.writeFileSync(destination, bytes);
}

const organizations = JSON.parse(fs.readFileSync(orgsFile, "utf-8"));
fs.mkdirSync(imageDir, { recursive: true });

const rootItems = parseDriveItems(await fetchText(driveRootFolderUrl));
const folderByName = new Map(
  rootItems.map((folder) => [canonicalNorm(folder.title), folder]),
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

  const files = await fetchDriveFolderItems(folder.id);
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
  await downloadPng(picked.file.id, destination);

  const imagePath = `/images/organizations/${filename}`;
  if (organization.image !== imagePath) {
    changes.push(`${organization.name}: ${organization.image ?? "(none)"} -> ${imagePath}`);
    organization.image = imagePath;
  }
  if (!picked.exact) {
    warnings.push(`${organization.name}: using fallback ${picked.file.title}; add ${organization.name} - Symbol (v.0).png when ready`);
  }
}

fs.writeFileSync(orgsFile, JSON.stringify(organizations, null, 2) + "\n", "utf-8");

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
