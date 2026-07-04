// Shared SQLite helper for sync scripts.
// Sync scripts run from the repo root and cannot import TypeScript,
// so this plain-JS module provides a database handle equivalent to
// what apps/web/lib/db.ts exports.
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(root, "content", "suwaneegamers.db");

let _db = null;

export function getDb() {
  if (_db) return _db;
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS content_documents (
      path        TEXT PRIMARY KEY,
      json        TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      source      TEXT NOT NULL DEFAULT 'filesystem'
    );
  `);
  return _db;
}
