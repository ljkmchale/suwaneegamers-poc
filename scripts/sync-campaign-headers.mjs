// Sync campaign header images from the shared Google Drive Campaigns folder.
//
// Source convention:
//   <Campaign Name> - Header (v.0).jpg
//   <Campaign Name> - Header (v.0).png
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDriveRootFolderUrl = "https://drive.google.com/drive/folders/1DOw_M3cldvFOS8E-e0A-ba0TvMm3PCjy?usp=sharing";
const autoManagedPagesFile = path.join(root, "content", "auto-managed-pages.json");
const campaignsFile = path.join(root, "content", "campaigns.json");
const previousCampaignsLayoutFile = path.join(root, "content", "page-layouts", "previous-campaigns.json");
const campaignLayoutsDir = path.join(root, "content", "page-layouts", "campaigns");
const imageDir = path.join(root, "apps", "web", "public", "images", "campaigns");

function configuredCampaignHeaderFolderUrl() {
  try {
    const pages = JSON.parse(fs.readFileSync(autoManagedPagesFile, "utf-8"));
    const campaignsPage = pages.find((page) => page.path === "/campaigns");
    const source = campaignsPage?.managedSources?.find((item) =>
      /campaign headers/i.test(item.label),
    );
    return source?.url || defaultDriveRootFolderUrl;
  } catch {
    return defaultDriveRootFolderUrl;
  }
}

const driveRootFolderUrl = configuredCampaignHeaderFolderUrl();
const driveRootFolderId =
  /\/folders\/([^/?#]+)/.exec(driveRootFolderUrl)?.[1] ?? "1DOw_M3cldvFOS8E-e0A-ba0TvMm3PCjy";

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
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
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

function isHeaderV0(title) {
  return / - Header \(v\.0\)\.(jpe?g|png)$/i.test(title);
}

function extensionFor(title, bytes) {
  const fromName = title.match(/\.(jpe?g|png)$/i)?.[1]?.toLowerCase();
  if (fromName) return fromName === "jpeg" ? "jpg" : fromName;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  return "jpg";
}

function pickHeaderFile(campaign, files) {
  const candidateNames = [campaign.name, ...(campaign.aliases ?? [])].map(norm);
  const headerFiles = files.filter((file) => isHeaderV0(file.title));

  const exact = headerFiles.find((file) => {
    const fileName = file.title.split(" - Header ")[0] ?? "";
    return candidateNames.includes(norm(fileName));
  });
  if (exact) return { file: exact, exact: true };

  return headerFiles[0] ? { file: headerFiles[0], exact: false } : null;
}

async function findHeaderInFolder(campaign, folder) {
  const files = await fetchDriveFolderItems(folder.id);
  const picked = pickHeaderFile(campaign, files);
  if (picked) return { ...picked, containingFolder: folder, nested: false };

  for (const child of files) {
    if (pickHeaderFile(campaign, [child])) continue;
    if (!/^(Art|Images|Archive)$/i.test(child.title)) continue;
    const childFiles = await fetchDriveFolderItems(child.id);
    const nested = pickHeaderFile(campaign, childFiles);
    if (nested) return { ...nested, containingFolder: child, nested: true };
  }

  return null;
}

async function downloadImage(fileId) {
  const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed for ${fileId}: HTTP ${res.status}`);

  const bytes = Buffer.from(await res.arrayBuffer());
  const isPng = bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47;
  const isJpeg = bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff;
  if (!isPng && !isJpeg) throw new Error(`Drive file ${fileId} did not download as a PNG/JPG`);

  return bytes;
}

function setPropIfDifferent(props, key, value) {
  if (value === undefined) return false;
  if (props[key] === value) return false;
  props[key] = value;
  return true;
}

function updateCampaignDetailLayout(campaign) {
  const layoutFile = path.join(campaignLayoutsDir, `${campaign.id}.json`);
  if (!fs.existsSync(layoutFile)) return false;

  const items = JSON.parse(fs.readFileSync(layoutFile, "utf-8"));
  let changed = false;

  for (const item of items) {
    if (item?.kind !== "block" || item.type !== "campaign-hero") continue;
    item.props ??= {};
    changed = setPropIfDifferent(item.props, "image", campaign.headerImage ?? "") || changed;
    changed = setPropIfDifferent(item.props, "imagePosition", campaign.headerImagePosition ?? "center") || changed;
    changed = setPropIfDifferent(item.props, "imageSourceFolder", campaign.headerImageSourceFolder) || changed;
    changed = setPropIfDifferent(item.props, "imageSourceFileId", campaign.headerImageSourceFileId) || changed;
    changed = setPropIfDifferent(item.props, "imageSourceFileName", campaign.headerImageSourceFileName) || changed;
  }

  if (changed) {
    fs.writeFileSync(layoutFile, JSON.stringify(items, null, 2) + "\n", "utf-8");
  }

  return changed;
}

const campaigns = JSON.parse(fs.readFileSync(campaignsFile, "utf-8"));
fs.mkdirSync(imageDir, { recursive: true });

const rootItems = parseDriveItems(await fetchText(driveRootFolderUrl));
const folderByName = new Map(rootItems.map((item) => [norm(item.title), item]));
const changes = [];
const warnings = [];

for (const campaign of campaigns) {
  const folder = [campaign.name, ...(campaign.aliases ?? [])]
    .map((name) => folderByName.get(norm(name)))
    .find(Boolean);

  if (!folder) {
    warnings.push(`${campaign.name}: no matching Drive subfolder found`);
    continue;
  }

  const picked = await findHeaderInFolder(campaign, folder);
  if (!picked) {
    warnings.push(`${campaign.name}: no ${campaign.name} - Header (v.0).jpg/png found`);
    continue;
  }

  const bytes = await downloadImage(picked.file.id);
  const ext = extensionFor(picked.file.title, bytes);
  const filename = `${slugify(campaign.name)}.${ext}`;
  const destination = path.join(imageDir, filename);
  fs.writeFileSync(destination, bytes);

  const imagePath = `/images/campaigns/${filename}`;
  if (campaign.headerImage !== imagePath) {
    changes.push(`${campaign.name}: ${campaign.headerImage ?? "(none)"} -> ${imagePath}`);
    campaign.headerImage = imagePath;
  }

  campaign.headerImageSourceFolder = driveRootFolderId;
  campaign.headerImageSourceFileId = picked.file.id;
  campaign.headerImageSourceFileName = picked.file.title;

  if (updateCampaignDetailLayout(campaign)) {
    changes.push(`${campaign.name}: updated saved campaign detail hero`);
  }

  if (!picked.exact) {
    warnings.push(`${campaign.name}: using fallback header ${picked.file.title}`);
  }
  if (picked.nested) {
    warnings.push(`${campaign.name}: found header inside nested ${picked.containingFolder.title} folder`);
  }
}

fs.writeFileSync(campaignsFile, JSON.stringify(campaigns, null, 2) + "\n", "utf-8");

// --- Archived campaign cards in previous-campaigns.json ---
const previousLayouts = JSON.parse(fs.readFileSync(previousCampaignsLayoutFile, "utf-8"));
const archivedCards = previousLayouts.filter((i) => i.type === "archived-campaign-card");

for (const card of archivedCards) {
  const title = card.props.title;
  const folder = [title, ...(card.props.aliases ?? [])].map((n) => folderByName.get(norm(n))).find(Boolean);

  if (!folder) {
    warnings.push(`${title} (archived): no matching Drive subfolder found`);
    continue;
  }

  const picked = await findHeaderInFolder({ name: title, aliases: card.props.aliases ?? [] }, folder);
  if (!picked) {
    warnings.push(`${title} (archived): no Header (v.0) file found`);
    continue;
  }

  const bytes = await downloadImage(picked.file.id);
  const ext = extensionFor(picked.file.title, bytes);
  const filename = `${slugify(title)}.${ext}`;
  const destination = path.join(imageDir, filename);
  fs.writeFileSync(destination, bytes);

  const imagePath = `/images/campaigns/${filename}`;
  if (card.props.image !== imagePath) {
    changes.push(`${title} (archived): ${card.props.image || "(none)"} -> ${imagePath}`);
    card.props.image = imagePath;
  }
}

fs.writeFileSync(previousCampaignsLayoutFile, JSON.stringify(previousLayouts, null, 2) + "\n", "utf-8");

const stamp = new Date().toISOString();
console.log(`[${stamp}] Campaign headers synced from Drive folder ${driveRootFolderId}`);
console.log(`Downloaded/verified ${campaigns.filter((campaign) => campaign.headerImageSourceFolder === driveRootFolderId).length} campaign header reference(s).`);

if (changes.length) {
  console.log("Changes:");
  for (const change of changes) console.log(`  ${change}`);
} else {
  console.log("No campaign header image field changes.");
}

if (warnings.length) {
  console.log("Warnings:");
  for (const warning of warnings) console.log(`  ${warning}`);
}
