// Imports JSON content files into SQLite so the app can read content from DB.
//
// The JSON files remain as a compatibility mirror for editors and legacy
// scripts, but runtime helpers prefer content_documents when present.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./sync-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(root, "content");
const ignored = new Set(["suwaneegamers.db", "suwaneegamers.db-shm", "suwaneegamers.db-wal"]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    if (!entry.isFile() || !entry.name.endsWith(".json") || ignored.has(entry.name)) return [];
    return [entryPath];
  });
}

function relativeContentPath(filePath) {
  return path.relative(contentRoot, filePath).replaceAll(path.sep, "/");
}

const db = getDb();
db.exec(`
  CREATE TABLE IF NOT EXISTS content_documents (
    path        TEXT PRIMARY KEY,
    json        TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'filesystem'
  );
`);

const upsert = db.prepare(`
  INSERT INTO content_documents (path, json, updated_at, source)
  VALUES (?, ?, ?, 'filesystem')
  ON CONFLICT(path) DO UPDATE SET
    json = excluded.json,
    updated_at = excluded.updated_at,
    source = excluded.source
`);

const files = walk(contentRoot);
const stamp = new Date().toISOString();
let changed = 0;

db.transaction(() => {
  for (const file of files) {
    const json = fs.readFileSync(file, "utf-8");
    JSON.parse(json);
    const key = relativeContentPath(file);
    const current = db.prepare(`SELECT json FROM content_documents WHERE path = ?`).get(key);
    if (current?.json !== json) changed += 1;
    upsert.run(key, json, stamp);
  }
})();

console.log(`[${stamp}] Synced ${files.length} JSON content documents into SQLite (${changed} changed).`);
