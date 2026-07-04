// Sync session recording audio links from Drive into session_summaries.audio_links.
//
// Drive convention:
//   Campaigns root → {Campaign Name} folder → Session Summaries Audio → {N} - {Title}.mp3
//
// Merge rules:
//   - New file found in Drive → adds entry by fileId (never duplicates)
//   - Existing file already in audio_links → skipped
//   - Entries already in audio_links not found in Drive → kept (never deleted)
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./sync-db.mjs";
import { readContent } from "./content-documents.mjs";
import { listDriveItems } from "./drive-api.mjs";

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

const DRIVE_ROOT_FOLDER_ID =
  folderIdFromUrl(
    configuredDriveFolderUrl(
      "/campaigns",
      /campaign headers/i,
      "https://drive.google.com/drive/folders/1DOw_M3cldvFOS8E-e0A-ba0TvMm3PCjy",
    ),
  ) ?? "1DOw_M3cldvFOS8E-e0A-ba0TvMm3PCjy";

function norm(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

// Extract leading session number from audio filename: "28 - Title.mp3" → 28
function sessionNumberFromFilename(filename) {
  const m = /^(\d+)\s*[-–]/.exec(filename);
  return m ? parseInt(m[1], 10) : null;
}

// Extract session number from DB title: "Session 28 - Title" → 28
function sessionNumberFromTitle(title) {
  const m = /(?:Session\s+)?(\d+)\s*[-–]/i.exec(title);
  return m ? parseInt(m[1], 10) : null;
}

// Strip .txt.mp3 artifact and .mp3 to get clean title portion
function cleanAudioTitle(filename) {
  return filename
    .replace(/\.txt\.mp3$/i, "")
    .replace(/\.mp3$/i, "")
    .replace(/^\d+\s*[-–]\s*/, "")
    .trim();
}

const db = getDb();

const campaigns = db.prepare("SELECT id, name, aliases FROM campaigns").all().map((row) => ({
  id: row.id,
  name: row.name,
  aliases: JSON.parse(row.aliases ?? "[]"),
}));

const sessions = db.prepare(
  "SELECT id, campaign_id, title, audio_links FROM session_summaries",
).all().map((row) => ({
  id: row.id,
  campaignId: row.campaign_id,
  title: row.title,
  sessionNumber: sessionNumberFromTitle(row.title),
  audioLinks: JSON.parse(row.audio_links ?? "[]"),
}));

// Index sessions by campaign_id → session_number for fast lookup
const sessionIndex = new Map();
for (const s of sessions) {
  const key = `${s.campaignId}::${s.sessionNumber}`;
  sessionIndex.set(key, s);
}

const rootRaw = await listDriveItems(DRIVE_ROOT_FOLDER_ID);
const folderByName = new Map(rootRaw.map((f) => [norm(f.name), { id: f.id, title: f.name }]));

const changes = [];
const warnings = [];
const updates = new Map(); // session.id → new audio_links array

for (const campaign of campaigns) {
  const folder = [campaign.name, ...campaign.aliases]
    .map((name) => folderByName.get(norm(name)))
    .find(Boolean);

  if (!folder) {
    warnings.push(`${campaign.name}: no matching Drive subfolder found`);
    continue;
  }

  const subRaw = await listDriveItems(folder.id);
  const subItems = subRaw.map((f) => ({ id: f.id, title: f.name }));
  const audioFolder = subItems.find((item) => /session\s+summar/i.test(item.title) && /audio/i.test(item.title))
    ?? subItems.find((item) => /audio/i.test(item.title));

  if (!audioFolder) {
    // Not all campaigns have audio yet — skip silently
    continue;
  }

  const audioRaw = await listDriveItems(audioFolder.id);
  const mp3Files = audioRaw
    .map((f) => ({ id: f.id, title: f.name }))
    .filter((f) => /\.(?:mp3|txt\.mp3)$/i.test(f.title));

  if (mp3Files.length === 0) {
    warnings.push(`${campaign.name}: Session Summaries Audio folder is empty`);
    continue;
  }

  for (const file of mp3Files) {
    const num = sessionNumberFromFilename(file.title);
    if (num === null) {
      warnings.push(`${campaign.name}: could not parse session number from "${file.title}"`);
      continue;
    }

    const key = `${campaign.id}::${num}`;
    const session = sessionIndex.get(key);
    if (!session) {
      warnings.push(`${campaign.name}: no session #${num} in DB (audio file: "${file.title}")`);
      continue;
    }

    const driveUrl = `https://drive.google.com/file/d/${file.id}/view?usp=sharing`;
    const alreadyLinked = session.audioLinks.some((link) =>
      link.url?.includes(file.id),
    );
    if (alreadyLinked) continue;

    const title = cleanAudioTitle(file.title);
    const label = `${session.title} Recording`;
    const newLink = { label, url: driveUrl };

    const pending = updates.get(session.id) ?? session.audioLinks;
    updates.set(session.id, [...pending, newLink]);
    changes.push(`${campaign.name} #${num}: added audio link "${label}"`);
  }
}

if (updates.size > 0) {
  const updateAudio = db.prepare(
    "UPDATE session_summaries SET audio_links = ? WHERE id = ?",
  );
  db.transaction(() => {
    for (const [id, links] of updates) {
      updateAudio.run(JSON.stringify(links), id);
    }
  })();
}

const stamp = new Date().toISOString();
console.log(`[${stamp}] Session audio sync complete`);
console.log(`Scanned ${campaigns.length} campaigns, updated ${updates.size} session(s).`);

if (changes.length) {
  console.log("Changes:");
  for (const change of changes) console.log(`  ${change}`);
} else {
  console.log("No new audio links found.");
}

if (warnings.length) {
  console.log("Warnings:");
  for (const warning of warnings) console.log(`  ${warning}`);
}
