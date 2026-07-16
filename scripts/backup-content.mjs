// Nightly backup of the content directory (SQLite DB + JSON + images).
// Run by the "SuwaneeGamers Content Backup" Windows scheduled task via
// backup-content.cmd. Writes to backups/YYYY-MM-DD/ at the repo root and
// keeps RETENTION_DAYS of dated folders.
//
// The SQLite database runs in WAL mode and may be open by the dev or
// production server, so it is copied with the better-sqlite3 online backup
// API rather than a raw file copy.
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const RETENTION_DAYS = 14;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const backupsDir = path.join(root, "backups");

const today = new Date().toISOString().slice(0, 10);
const destDir = path.join(backupsDir, today);

const log = (message) => console.log(`[backup-content] ${message}`);

fs.mkdirSync(destDir, { recursive: true });

// 1. Online backup of the SQLite database (safe while the server has it open).
const dbPath = path.join(contentDir, "suwaneegamers.db");
const db = new Database(dbPath, { readonly: true });
await db.backup(path.join(destDir, "suwaneegamers.db"));
db.close();
log(`database backed up (${(fs.statSync(path.join(destDir, "suwaneegamers.db")).size / 1024 / 1024).toFixed(1)} MB)`);

// 2. Copy the rest of content/ (JSON, layouts, images) excluding the live DB files.
const skip = new Set(["suwaneegamers.db", "suwaneegamers.db-wal", "suwaneegamers.db-shm"]);
fs.cpSync(contentDir, destDir, {
  recursive: true,
  filter: (src) => !skip.has(path.basename(src)),
});
log("content files copied");

// 3. Rotate: remove dated backup folders older than RETENTION_DAYS.
const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
for (const entry of fs.readdirSync(backupsDir, { withFileTypes: true })) {
  if (entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name) && entry.name < cutoff) {
    fs.rmSync(path.join(backupsDir, entry.name), { recursive: true, force: true });
    log(`pruned old backup ${entry.name}`);
  }
}

log(`done -> ${destDir}`);
