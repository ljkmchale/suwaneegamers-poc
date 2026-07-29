// Sync campaign header images from the shared Google Drive Campaigns folder.
//
// Source convention:
//   <Campaign Name> - Header (v.0).jpg
//   <Campaign Name> - Header (v.0).png
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./sync-db.mjs";
import { readContent, writeContent, contentPath } from "./content-documents.mjs";
import { listDriveItems, downloadDriveFile, driveDownloadDelay } from "./drive-api.mjs";
import { saveOptimizedImage } from "./lib-image-cache.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDriveRootFolderUrl = "https://drive.google.com/drive/folders/1DOw_M3cldvFOS8E-e0A-ba0TvMm3PCjy?usp=sharing";
const imageDir = path.join(root, "apps", "web", "media", "images", "campaigns");

const fallbackHeaderFiles = [
  {
    folderId: "0B8w9jlHOwNHxTlg0bEdSbTBCV2M",
    campaignName: "Order of the Raven",
    file: {
      id: "1RcnS0kfAX-60R75nlizoQk7gwOQK3Rtp",
      title: "Order of the Raven - Header (v.0).jpg",
    },
  },
];

function configuredCampaignHeaderFolderUrl() {
  try {
    const pages = readContent("auto-managed-pages.json");
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

function norm(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isHeaderV0(title) {
  return /\s+-\s*Header\s+\(v\.0\)\.(jpe?g|png)$/i.test(title);
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
    const fileName = file.title.replace(/\s+-\s*Header\s+\(v\.0\)\.(jpe?g|png)$/i, "");
    return candidateNames.includes(norm(fileName));
  });
  if (exact) return { file: exact, exact: true };

  return headerFiles[0] ? { file: headerFiles[0], exact: false } : null;
}

function fallbackHeaderFor(campaign, folder) {
  const candidateNames = [campaign.name, ...(campaign.aliases ?? [])].map(norm);
  const fallback = fallbackHeaderFiles.find((item) =>
    item.folderId === folder.id && candidateNames.includes(norm(item.campaignName)),
  );

  return fallback ? { file: fallback.file, exact: true } : null;
}

function candidateCampaignNames(name, aliases = []) {
  const names = [name, ...aliases];
  const firstInstallmentName = name.replace(/\s+I$/i, "").trim();

  if (firstInstallmentName && firstInstallmentName !== name) {
    names.push(firstInstallmentName);
  }

  return names;
}

async function findHeaderInFolder(campaign, folder) {
  const rawItems = await listDriveItems(folder.id);
  const files = rawItems.map((f) => ({ id: f.id, title: f.name, isFolder: f.mimeType === "application/vnd.google-apps.folder" }));

  const picked = pickHeaderFile(campaign, files);
  if (picked) return { ...picked, containingFolder: folder, nested: false };

  const fallback = fallbackHeaderFor(campaign, folder);
  if (fallback) return { ...fallback, containingFolder: folder, nested: false };

  for (const child of files) {
    if (!child.isFolder) continue;
    if (!/^(Art|Images|Archive)$/i.test(child.title)) continue;
    const childRaw = await listDriveItems(child.id);
    const childFiles = childRaw.map((f) => ({ id: f.id, title: f.name }));
    const nested = pickHeaderFile(campaign, childFiles);
    if (nested) return { ...nested, containingFolder: child, nested: true };
  }

  return null;
}

async function tryDownloadImage(fileId) {
  try {
    await driveDownloadDelay();
    const bytes = await downloadDriveFile(fileId);
    const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isPng && !isJpeg) return null;
    return bytes;
  } catch {
    return null;
  }
}

function setPropIfDifferent(props, key, value) {
  if (value === undefined) return false;
  if (props[key] === value) return false;
  props[key] = value;
  return true;
}

function updateCampaignDetailLayout(campaign) {
  const layoutKey = `page-layouts/campaigns/${campaign.id}.json`;
  const layoutFile = contentPath(layoutKey);
  if (!fs.existsSync(layoutFile)) return false;

  const items = readContent(layoutKey);
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
    writeContent(layoutKey, items);
  }

  return changed;
}

const db = getDb();
const campaigns = db.prepare(
  `SELECT id, name, header_image, header_image_position, header_image_source_folder, header_image_source_file_id, header_image_source_file_name, aliases FROM campaigns`,
).all().map((row) => ({
  id: row.id,
  name: row.name,
  headerImage: row.header_image,
  headerImagePosition: row.header_image_position,
  headerImageSourceFolder: row.header_image_source_folder,
  headerImageSourceFileId: row.header_image_source_file_id,
  headerImageSourceFileName: row.header_image_source_file_name,
  aliases: JSON.parse(row.aliases ?? "[]"),
}));
fs.mkdirSync(imageDir, { recursive: true });

const rootRaw = await listDriveItems(driveRootFolderId);
const rootItems = rootRaw.map((f) => ({ id: f.id, title: f.name }));
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

  const bytes = await tryDownloadImage(picked.file.id);
  if (!bytes) {
    warnings.push(`${campaign.name}: Drive blocked download for ${picked.file.title}; keeping existing local cache`);
    continue;
  }

  const ext = extensionFor(picked.file.title, bytes);
  const filename = await saveOptimizedImage(imageDir, slugify(campaign.name), bytes, bytes.length, {
    fallbackExtension: ext,
  });

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

const updateHeader = db.prepare(
  `UPDATE campaigns SET header_image = ?, header_image_source_folder = ?, header_image_source_file_id = ?, header_image_source_file_name = ? WHERE id = ?`,
);
db.transaction(() => {
  for (const campaign of campaigns) {
    updateHeader.run(
      campaign.headerImage ?? null,
      campaign.headerImageSourceFolder ?? null,
      campaign.headerImageSourceFileId ?? null,
      campaign.headerImageSourceFileName ?? null,
      campaign.id,
    );
  }
})();

// --- Archived campaign cards in previous-campaigns.json ---
const previousLayouts = readContent("page-layouts/previous-campaigns.json");
const archivedCards = previousLayouts.filter((i) => i.type === "archived-campaign-card");

for (const card of archivedCards) {
  const title = card.props.title;
  const aliases = card.props.aliases ?? [];
  const names = candidateCampaignNames(title, aliases);
  const folder = names.map((n) => folderByName.get(norm(n))).find(Boolean);

  if (!folder) {
    warnings.push(`${title} (archived): no matching Drive subfolder found`);
    continue;
  }

  const picked = await findHeaderInFolder({ name: title, aliases: names.slice(1) }, folder);
  if (!picked) {
    warnings.push(`${title} (archived): no Header (v.0) file found`);
    continue;
  }

  const bytes = await tryDownloadImage(picked.file.id);
  if (!bytes) {
    warnings.push(`${title} (archived): Drive blocked download for ${picked.file.title}; keeping existing local cache`);
    continue;
  }

  const ext = extensionFor(picked.file.title, bytes);
  const filename = await saveOptimizedImage(imageDir, slugify(title), bytes, bytes.length, {
    fallbackExtension: ext,
  });

  const imagePath = `/images/campaigns/${filename}`;
  if (card.props.image !== imagePath) {
    changes.push(`${title} (archived): ${card.props.image || "(none)"} -> ${imagePath}`);
    card.props.image = imagePath;
  }
}

if (changes.length) {
  writeContent("page-layouts/previous-campaigns.json", previousLayouts);
}

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
