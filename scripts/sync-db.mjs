// Shared SQLite helper for sync scripts.
// Sync scripts run from the repo root and cannot import TypeScript,
// so this plain-JS module provides a database handle equivalent to
// what apps/web/lib/db.ts exports.
//
// Every script that touches suwaneegamers.db should open it through here
// rather than constructing its own `new Database(...)`. A hand-rolled open
// silently drops the pragmas below — most importantly foreign_keys, without
// which ON DELETE CASCADE is a no-op and deletes leave orphaned rows behind.
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
  // Several processes write this file — the dev server, the prod service, and
  // whichever sync scripts the scheduler has spawned. Writers serialize, and a
  // bulk sync can outlast better-sqlite3's 5s default. Keep in step with
  // apps/web/lib/db.ts.
  _db.pragma("busy_timeout = 15000");
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

/**
 * Script-side twin of apps/web/lib/retention.ts. Deletes rows older than
 * `days` from an append-only log table. Unlike the app-side helper this has no
 * once-per-24h guard — callers here are cron-driven and already run on a
 * schedule, so they prune exactly when they run.
 *
 * Returns the number of rows deleted.
 */
export function pruneExpired(db, { table, column, days }) {
  if (!/^[a-z_][a-z0-9_]*$/.test(table) || !/^[a-z_][a-z0-9_]*$/.test(column)) {
    throw new Error(`Unsafe identifier in prune: ${table}.${column}`);
  }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return db.prepare(`DELETE FROM ${table} WHERE ${column} < ?`).run(cutoff).changes;
}
