// One-time migration: reads all content JSON files and populates suwaneegamers.db.
// Safe to re-run — uses INSERT OR REPLACE so existing rows are overwritten.
//
// Run from repo root:  node scripts/migrate-to-sqlite.mjs
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const dbPath = path.join(contentDir, "suwaneegamers.db");

function readJson(filename) {
  const file = path.join(contentDir, filename);
  if (!fs.existsSync(file)) {
    console.warn(`  SKIP: ${filename} not found`);
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// Schema (mirrors apps/web/lib/db.ts — keep in sync)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id                           TEXT PRIMARY KEY,
    name                         TEXT NOT NULL,
    dm                           TEXT NOT NULL,
    schedule                     TEXT NOT NULL,
    description                  TEXT NOT NULL,
    header_image                 TEXT,
    header_image_position        TEXT NOT NULL DEFAULT 'center',
    header_image_source_folder   TEXT,
    header_image_source_file_id  TEXT,
    header_image_source_file_name TEXT,
    official                     INTEGER NOT NULL DEFAULT 1,
    player_notes_url             TEXT,
    aliases                      TEXT NOT NULL DEFAULT '[]',
    resources                    TEXT NOT NULL DEFAULT '[]',
    party                        TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS session_summaries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id  TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title        TEXT    NOT NULL,
    summary      TEXT    NOT NULL,
    audio_links  TEXT    NOT NULL DEFAULT '[]',
    auto         INTEGER NOT NULL DEFAULT 0,
    session_date TEXT,
    sort_order   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_session_summaries_campaign
    ON session_summaries(campaign_id, sort_order);

  CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
    campaign_id UNINDEXED,
    title,
    summary,
    content=session_summaries,
    content_rowid=id
  );

  CREATE TRIGGER IF NOT EXISTS ss_ai AFTER INSERT ON session_summaries BEGIN
    INSERT INTO session_summaries_fts(rowid, campaign_id, title, summary)
      VALUES (new.id, new.campaign_id, new.title, new.summary);
  END;

  CREATE TRIGGER IF NOT EXISTS ss_ad AFTER DELETE ON session_summaries BEGIN
    INSERT INTO session_summaries_fts(session_summaries_fts, rowid, campaign_id, title, summary)
      VALUES ('delete', old.id, old.campaign_id, old.title, old.summary);
  END;

  CREATE TRIGGER IF NOT EXISTS ss_au AFTER UPDATE ON session_summaries BEGIN
    INSERT INTO session_summaries_fts(session_summaries_fts, rowid, campaign_id, title, summary)
      VALUES ('delete', old.id, old.campaign_id, old.title, old.summary);
    INSERT INTO session_summaries_fts(rowid, campaign_id, title, summary)
      VALUES (new.id, new.campaign_id, new.title, new.summary);
  END;

  CREATE TABLE IF NOT EXISTS dungeon_masters (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    focus              TEXT NOT NULL,
    description        TEXT NOT NULL,
    portrait           TEXT,
    previous_campaigns TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS players (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    portrait    TEXT
  );

  CREATE TABLE IF NOT EXISTS organizations (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    known_for   TEXT,
    summary     TEXT,
    details     TEXT,
    description TEXT,
    image       TEXT,
    href        TEXT,
    faction     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS territories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    capital     TEXT,
    region      TEXT NOT NULL,
    description TEXT NOT NULL,
    image       TEXT,
    href        TEXT
  );

  CREATE TABLE IF NOT EXISTS campaign_dms (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    dm_id       TEXT NOT NULL REFERENCES dungeon_masters(id) ON DELETE CASCADE,
    PRIMARY KEY (campaign_id, dm_id)
  );

  CREATE INDEX IF NOT EXISTS idx_campaign_dms_dm ON campaign_dms(dm_id);
  CREATE INDEX IF NOT EXISTS idx_gazetteer_region ON gazetteer(region);
  CREATE INDEX IF NOT EXISTS idx_campaigns_dm ON campaigns(dm);

  CREATE TABLE IF NOT EXISTS gazetteer (
    id                     TEXT PRIMARY KEY,
    title                  TEXT NOT NULL,
    slug                   TEXT NOT NULL UNIQUE,
    doc_url                TEXT NOT NULL,
    folder_url             TEXT,
    reference_url          TEXT,
    image_url              TEXT,
    image_source_file_id   TEXT,
    image_source_file_name TEXT,
    size                   TEXT,
    region                 TEXT,
    description            TEXT
  );

  CREATE TABLE IF NOT EXISTS content_documents (
    path        TEXT PRIMARY KEY,
    json        TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'filesystem'
  );
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function j(value) {
  return JSON.stringify(value ?? []);
}

function bool(value) {
  return value === false || value === 0 ? 0 : 1;
}

let totalInserted = 0;

function migrate(label, fn) {
  const before = totalInserted;
  const tx = db.transaction(fn);
  tx();
  console.log(`  ${label}: ${totalInserted - before} rows`);
}

// ---------------------------------------------------------------------------
// Campaigns + session summaries
// ---------------------------------------------------------------------------
migrate("campaigns + session_summaries", () => {
  const campaigns = readJson("campaigns.json");
  if (!campaigns) return;

  const upsertCampaign = db.prepare(`
    INSERT OR REPLACE INTO campaigns
      (id, name, dm, schedule, description,
       header_image, header_image_position,
       header_image_source_folder, header_image_source_file_id, header_image_source_file_name,
       official, player_notes_url, aliases, resources, party)
    VALUES
      (@id, @name, @dm, @schedule, @description,
       @header_image, @header_image_position,
       @header_image_source_folder, @header_image_source_file_id, @header_image_source_file_name,
       @official, @player_notes_url, @aliases, @resources, @party)
  `);

  // Delete existing summaries for campaigns we're re-importing so sort_order stays clean
  const deleteSummaries = db.prepare(`DELETE FROM session_summaries WHERE campaign_id = ?`);

  const insertSummary = db.prepare(`
    INSERT INTO session_summaries
      (campaign_id, title, summary, audio_links, auto, session_date, sort_order)
    VALUES
      (@campaign_id, @title, @summary, @audio_links, @auto, @session_date, @sort_order)
  `);

  for (const c of campaigns) {
    upsertCampaign.run({
      id: c.id,
      name: c.name,
      dm: c.dm,
      schedule: c.schedule,
      description: c.description,
      header_image: c.headerImage ?? null,
      header_image_position: c.headerImagePosition ?? "center",
      header_image_source_folder: c.headerImageSourceFolder ?? null,
      header_image_source_file_id: c.headerImageSourceFileId ?? null,
      header_image_source_file_name: c.headerImageSourceFileName ?? null,
      official: bool(c.official),
      player_notes_url: c.playerNotesUrl ?? null,
      aliases: j(c.aliases),
      resources: j(c.resources),
      party: j(c.party),
    });
    totalInserted++;

    deleteSummaries.run(c.id);
    for (const [i, s] of (c.sessionSummaries ?? []).entries()) {
      insertSummary.run({
        campaign_id: c.id,
        title: s.title,
        summary: s.summary,
        audio_links: j(s.audioLinks),
        auto: bool(s.auto),
        session_date: s.sessionDate ?? null,
        sort_order: i,
      });
      totalInserted++;
    }
  }
});

// ---------------------------------------------------------------------------
// Dungeon Masters
// ---------------------------------------------------------------------------
migrate("dungeon_masters", () => {
  const dms = readJson("dungeon-masters.json");
  if (!dms) return;

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO dungeon_masters
      (id, name, focus, description, portrait, previous_campaigns)
    VALUES
      (@id, @name, @focus, @description, @portrait, @previous_campaigns)
  `);

  for (const dm of dms) {
    upsert.run({
      id: dm.id,
      name: dm.name,
      focus: dm.focus,
      description: dm.description,
      portrait: dm.portrait ?? null,
      previous_campaigns: j(dm.previousCampaigns),
    });
    totalInserted++;
  }
});

// ---------------------------------------------------------------------------
// Campaign DM assignments (junction table)
// ---------------------------------------------------------------------------
migrate("campaign_dms", () => {
  const campaigns = readJson("campaigns.json");
  const dms = readJson("dungeon-masters.json");
  if (!campaigns || !dms) return;

  const dmByName = new Map(dms.map((d) => [d.name, d.id]));
  db.prepare(`DELETE FROM campaign_dms`).run();
  const insert = db.prepare(`INSERT OR IGNORE INTO campaign_dms (campaign_id, dm_id) VALUES (?, ?)`);

  for (const c of campaigns) {
    for (const dmName of c.dm.split(/\s*&\s*/)) {
      const dmId = dmByName.get(dmName.trim());
      if (dmId) {
        insert.run(c.id, dmId);
        totalInserted++;
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------
migrate("players", () => {
  const players = readJson("players.json");
  if (!players) return;

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO players (id, name, description, portrait)
    VALUES (@id, @name, @description, @portrait)
  `);

  for (const p of players) {
    upsert.run({
      id: p.id,
      name: p.name,
      description: p.description,
      portrait: p.portrait ?? null,
    });
    totalInserted++;
  }
});

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------
migrate("organizations", () => {
  const orgs = readJson("organizations.json");
  if (!orgs) return;

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO organizations
      (id, name, known_for, summary, details, description, image, href, faction)
    VALUES
      (@id, @name, @known_for, @summary, @details, @description, @image, @href, @faction)
  `);

  for (const o of orgs) {
    upsert.run({
      id: o.id,
      name: o.name,
      known_for: o.knownFor ?? null,
      summary: o.summary ?? null,
      details: o.details ?? null,
      description: o.description ?? null,
      image: o.image ?? null,
      href: o.href ?? null,
      faction: bool(o.faction),
    });
    totalInserted++;
  }
});

// ---------------------------------------------------------------------------
// Territories
// ---------------------------------------------------------------------------
migrate("territories", () => {
  const territories = readJson("territories.json");
  if (!territories) return;

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO territories (id, name, capital, region, description, image, href)
    VALUES (@id, @name, @capital, @region, @description, @image, @href)
  `);

  for (const t of territories) {
    upsert.run({
      id: t.id,
      name: t.name,
      capital: t.capital ?? null,
      region: t.region,
      description: t.description,
      image: t.image ?? null,
      href: t.href ?? null,
    });
    totalInserted++;
  }
});

// ---------------------------------------------------------------------------
// Gazetteer
// ---------------------------------------------------------------------------
migrate("gazetteer", () => {
  const entries = readJson("gazetteer.json");
  if (!entries) return;

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO gazetteer (
      id,
      title,
      slug,
      doc_url,
      folder_url,
      reference_url,
      image_url,
      image_source_file_id,
      image_source_file_name,
      size,
      region,
      description
    )
    VALUES (
      @id,
      @title,
      @slug,
      @doc_url,
      @folder_url,
      @reference_url,
      @image_url,
      @image_source_file_id,
      @image_source_file_name,
      @size,
      @region,
      @description
    )
  `);

  for (const e of entries) {
    upsert.run({
      id: e.id,
      title: e.title,
      slug: e.slug,
      doc_url: e.docUrl,
      folder_url: e.folderUrl ?? null,
      reference_url: e.referenceUrl ?? e.docUrl,
      image_url: e.imageUrl ?? null,
      image_source_file_id: e.imageSourceFileId ?? null,
      image_source_file_name: e.imageSourceFileName ?? null,
      size: e.size ?? "",
      region: e.region ?? "",
      description: e.description ?? "",
    });
    totalInserted++;
  }
});

// ---------------------------------------------------------------------------
// JSON content documents
// ---------------------------------------------------------------------------
function walkJsonFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkJsonFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
  });
}

migrate("content_documents", () => {
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO content_documents (path, json, updated_at, source)
    VALUES (?, ?, ?, 'filesystem')
  `);
  const stamp = new Date().toISOString();

  for (const file of walkJsonFiles(contentDir)) {
    const json = fs.readFileSync(file, "utf-8");
    JSON.parse(json);
    upsert.run(path.relative(contentDir, file).replaceAll(path.sep, "/"), json, stamp);
    totalInserted++;
  }
});

// ---------------------------------------------------------------------------
// Verify FTS index is populated
// ---------------------------------------------------------------------------
const ftsCount = db.prepare(`SELECT count(*) as n FROM session_summaries_fts`).get();
console.log(`\nFTS5 index: ${ftsCount.n} session summary rows indexed`);

// Quick sanity check
const sample = db.prepare(`
  SELECT s.campaign_id, s.title
  FROM session_summaries_fts f
  JOIN session_summaries s ON s.id = f.rowid
  WHERE session_summaries_fts MATCH 'dragon OR goblin OR tavern'
  LIMIT 3
`).all();
if (sample.length) {
  console.log("FTS5 test query (dragon|goblin|tavern):");
  sample.forEach((r) => console.log(`  [${r.campaign_id}] ${r.title}`));
}

db.close();
console.log(`\nDone. ${totalInserted} total rows written to ${dbPath}`);
