import Database from "better-sqlite3";
import path from "path";
import { contentDir } from "@/lib/contentFiles";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = path.join(contentDir(), "suwaneegamers.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initializeSchema(_db);
  return _db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- ----------------------------------------------------------------
    -- Campaigns
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS campaigns (
      id                           TEXT PRIMARY KEY,
      name                         TEXT NOT NULL,
      dm                           TEXT NOT NULL,
      schedule                     TEXT NOT NULL,
      description                  TEXT NOT NULL,
      reference_url                TEXT NOT NULL,
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

    -- ----------------------------------------------------------------
    -- Session summaries (split out of campaigns for unbounded growth)
    -- ----------------------------------------------------------------
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

    -- FTS5 for session summary search
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

    -- ----------------------------------------------------------------
    -- Dungeon Masters
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS dungeon_masters (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      focus               TEXT NOT NULL,
      description         TEXT NOT NULL,
      portrait            TEXT,
      active_campaign_ids TEXT NOT NULL DEFAULT '[]',
      previous_campaigns  TEXT NOT NULL DEFAULT '[]'
    );

    -- ----------------------------------------------------------------
    -- Players
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS players (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT NOT NULL,
      portrait      TEXT,
      dm_profile_id TEXT
    );

    -- ----------------------------------------------------------------
    -- Organizations
    -- ----------------------------------------------------------------
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

    -- ----------------------------------------------------------------
    -- Territories
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS territories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      capital     TEXT,
      region      TEXT NOT NULL,
      description TEXT NOT NULL,
      image       TEXT,
      href        TEXT
    );

    -- ----------------------------------------------------------------
    -- Gazetteer entries
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS gazetteer (
      id      TEXT PRIMARY KEY,
      title   TEXT NOT NULL,
      slug    TEXT NOT NULL,
      doc_url TEXT NOT NULL
    );
  `);
}
