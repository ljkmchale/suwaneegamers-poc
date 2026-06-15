// Sync Pantheon deity symbol PNGs from the shared Google Drive source folder.
//
// Source convention:
//   <Deity Name> - Symbol (v.0).png
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const driveFolderUrl = "https://drive.google.com/drive/folders/14mCaYtQov1JyQASn9HQ82PeoMI8y1ylI?usp=drive_link";
const driveFolderId = "14mCaYtQov1JyQASn9HQ82PeoMI8y1ylI";
const pantheonFile = path.join(root, "content", "page-layouts", "pantheon.json");
const imageDir = path.join(root, "apps", "web", "public", "images", "pantheon");

const driveNameAliases = new Map([
  ["valari", "villari"],
]);

const localImageAliases = new Map([
  ["oneeye", "oneeye"],
]);

const fallbackDriveSymbols = [
  { id: "117uEPszG6_0tZdZ4GqyVUqewBsBheqZV", title: "Ol'farium - Symbol (v.0).png" },
  { id: "1wCzGw19dw34fadH1oIe0YrNnSTk4SG5J", title: "Voegurn - Symbol (v.0).png" },
  { id: "18rbCFJUsBwMOv71yFxg_NH3FYHemz7bb", title: "Valari - Symbol (v.0).png" },
  { id: "1dnus1QaO9rFBIO3tDZB9s6m8SpIldMbP", title: "Utheri - Symbol (v.0).png" },
  { id: "1FU6CX4IZqXMxrCxIoafCnl_RjUo8a_Sr", title: "Urlich - Symbol (v.0).png" },
  { id: "1V_LYSjPunGPn7UWQGYh37wUrAor73lhm", title: "Tyvarion - Symbol (v.0).png" },
  { id: "1TZt1Zp3AvTBJO-QXWAC5K6wxha321vIH", title: "Tornia - Symbol (v.0).png" },
  { id: "1oUQGt1ayXRsFILbbKpHKBvYlo1JUH_dr", title: "Sylunara - Symbol (v.0).png" },
  { id: "1l50G5N_epoCGLY3xImbm1KxKdmDr-M7x", title: "Phoe - Symbol (v.0).png" },
  { id: "1BaNodep6M2b9sDgXys3jMyesjiDcH-IP", title: "Osanna - Symbol (v.0).png" },
  { id: "12XrtwvVhx-zGOJbxEOcEzVn8fsMQVo-H", title: "One-Eye - Symbol (v.0).png" },
  { id: "1tz2d21_dGU_GSXxbbVjndKzbN6RI-Uo2", title: "Nigrum - Symbol (v.0).png" },
  { id: "1pikd7EDY89StEbRCOkcQG9aqV06K6QPZ", title: "Natafae - Symbol (v.0).png" },
  { id: "1JyRxCIxpWVTmRgYXoQFbkKHclV4DOlrx", title: "Myrdris - Symbol (v.0).png" },
  { id: "1WQst7AuOz4IoDjDegtFWX4ttgZhnmUBs", title: "Muerg - Symbol (v.0).png" },
  { id: "1PWUqgf286GHsevmsAg3uVKfAt1Zv0LAd", title: "Layeth - Symbol (v.0).png" },
  { id: "1IKc50-oTjIt_qRCi0pyjtreOXDOKOQaf", title: "Iuz Obal - Symbol (v.0).png" },
  { id: "14lwOiv4ACe7FSn7212Gcnb0g9YWbSWy_", title: "Goldraen - Symbol (v.0).png" },
  { id: "15lqXTIewnTJbhUw5XXUtXIi-42jDJnDh", title: "Fralee - Symbol (v.0).png" },
  { id: "1DEwblS7dYHQQNNGBdXybQgXoy84gptGY", title: "Eredra - Symbol (v.0).png" },
  { id: "1K2W1vRFM_PlHPnSeLFmO2P-PbP-_CO1l", title: "Diverra - Symbol (v.0).png" },
  { id: "1YXi4ZVlU6O5yusc48YnKe5PUl9DVZLYu", title: "Crael - Symbol (v.0).png" },
  { id: "1NjYHixPSBatAlrk810Gg0E-0PoX2Q7ik", title: "Coralei - Symbol (v.0).png" },
  { id: "1x2-Q3sMoc7DkjazJgdKUuzQ4bPaRCG_B", title: "Cembus - Symbol (v.0).png" },
  { id: "1a5JHxGn5_vVsH-Dgx8aHKHZMbfOBFzec", title: "Celestine - Symbol (v.0).png" },
  { id: "1rO4BK48n5pnyFRSoUnp0hOTeXLPcsrvh", title: "Brault - Symbol (v.0).png" },
  { id: "1ETwFyZKvfkLPnB70gWUfkSbjTEDo4rJr", title: "Asmodeus - Symbol (v.0).png" },
  { id: "1EqiaanfF4hJz6TYzMKuxdLOhyL1HxH1Y", title: "Amriel - Symbol (v.0).png" },
  { id: "1nh12TZNQFS-8WNTKZIRMzcAzHbE3dTHv", title: "Addan - Symbol (v.0).png" },
];

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
  return driveNameAliases.get(key) ?? key;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
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

function getDeityName(block) {
  const title = block.props?.title ?? "";
  return title.split(/\s+[—-]\s+/u)[0].trim();
}

function getSymbolName(title) {
  return title.split(" - Symbol ")[0]?.trim() ?? title;
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

async function tryDownloadPng(fileId, destination) {
  try {
    await downloadPng(fileId, destination);
    return true;
  } catch (error) {
    return false;
  }
}

const layout = JSON.parse(fs.readFileSync(pantheonFile, "utf-8"));
fs.mkdirSync(imageDir, { recursive: true });

const parsedDriveItems = parseDriveItems(await fetchText(driveFolderUrl));
const driveItems = (parsedDriveItems.length ? parsedDriveItems : fallbackDriveSymbols)
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

  const filename = `${slugify(deityName)}-symbol.png`;
  const destination = path.join(imageDir, filename);
  const downloaded = await tryDownloadPng(symbol.id, destination);

  const fallbackSlug = localImageAliases.get(canonicalNorm(deityName)) ?? slugify(deityName);
  const fallbackFilename = `${fallbackSlug}.webp`;
  const fallbackPath = path.join(imageDir, fallbackFilename);
  const imagePath = downloaded
    ? `/images/pantheon/${filename}`
    : fs.existsSync(fallbackPath)
      ? `/images/pantheon/${fallbackFilename}`
      : `/images/pantheon/${filename}`;
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

fs.writeFileSync(pantheonFile, JSON.stringify(layout, null, 2) + "\n", "utf-8");

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
