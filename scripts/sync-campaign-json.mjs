// Keep the tracked campaigns.json mirror aligned with the runtime campaign tables.
// This is called after scheduled jobs that update campaign or session rows so a
// fresh clone can build and test from the same content production is serving.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./sync-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const campaignsPath = path.join(root, "content", "campaigns.json");

function optional(value) {
  return value === null || value === "" ? undefined : value;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value ?? "");
  } catch {
    return fallback;
  }
}

export function syncCampaignJsonFromDb(db = getDb()) {
  const existing = JSON.parse(fs.readFileSync(campaignsPath, "utf8"));
  const existingById = new Map(existing.map((campaign) => [campaign.id, campaign]));
  const campaignRows = db.prepare("SELECT * FROM campaigns ORDER BY rowid").all();
  const sessionRows = db.prepare(
    "SELECT campaign_id, title, summary, audio_links, auto, session_date FROM session_summaries ORDER BY campaign_id, sort_order",
  ).all();
  const sessionsByCampaign = new Map();

  for (const row of sessionRows) {
    const sessions = sessionsByCampaign.get(row.campaign_id) ?? [];
    const audioLinks = parseJson(row.audio_links, []);
    sessions.push({
      title: row.title,
      summary: row.summary,
      ...(audioLinks.length ? { audioLinks } : {}),
      ...(row.auto ? { auto: true } : {}),
      ...(row.session_date ? { sessionDate: row.session_date } : {}),
    });
    sessionsByCampaign.set(row.campaign_id, sessions);
  }

  const campaigns = campaignRows.map((row) => ({
    ...(existingById.get(row.id) ?? {}),
    id: row.id,
    name: row.name,
    dm: row.dm,
    schedule: row.schedule,
    startDate: optional(row.start_date),
    endDate: optional(row.end_date),
    description: row.description,
    headerImage: optional(row.header_image),
    headerImagePosition: optional(row.header_image_position),
    headerImageSourceFolder: optional(row.header_image_source_folder),
    headerImageSourceFileId: optional(row.header_image_source_file_id),
    headerImageSourceFileName: optional(row.header_image_source_file_name),
    official: Boolean(row.official),
    playerNotesUrl: optional(row.player_notes_url),
    aliases: parseJson(row.aliases, []),
    resources: parseJson(row.resources, []),
    party: parseJson(row.party, []),
    sessionSummaries: sessionsByCampaign.get(row.id) ?? [],
  }));
  const json = `${JSON.stringify(campaigns, null, 2)}\n`;
  const previous = fs.readFileSync(campaignsPath, "utf8");
  if (json === previous) return { changed: false, campaigns: campaigns.length };

  fs.writeFileSync(campaignsPath, json, "utf8");
  db.prepare(`
    INSERT INTO content_documents (path, json, updated_at, source)
    VALUES ('campaigns.json', ?, ?, 'filesystem')
    ON CONFLICT(path) DO UPDATE SET
      json = excluded.json,
      updated_at = excluded.updated_at,
      source = excluded.source
  `).run(json, new Date().toISOString());

  return { changed: true, campaigns: campaigns.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = syncCampaignJsonFromDb();
  console.log(
    `${result.changed ? "Updated" : "Verified"} campaigns.json from ${result.campaigns} runtime campaign(s).`,
  );
}
