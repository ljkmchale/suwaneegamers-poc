import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./sync-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(root, "content");

function normalizeKey(filename) {
  return filename.replaceAll("\\", "/").replace(/^\/+/, "");
}

function ensureTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_documents (
      path        TEXT PRIMARY KEY,
      json        TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      source      TEXT NOT NULL DEFAULT 'filesystem'
    );
  `);
}

export function contentPath(filename) {
  return path.join(contentRoot, normalizeKey(filename));
}

export function readContentJson(filename) {
  const key = normalizeKey(filename);
  const db = getDb();
  ensureTable(db);
  const row = db.prepare(`SELECT json FROM content_documents WHERE path = ?`).get(key);
  if (row?.json) return row.json;
  return fs.readFileSync(contentPath(key), "utf-8");
}

export function readContent(filename) {
  return JSON.parse(readContentJson(filename));
}

export function writeContent(filename, data, source = "sync") {
  const key = normalizeKey(filename);
  const json = JSON.stringify(data, null, 2) + "\n";
  const db = getDb();
  ensureTable(db);
  db.prepare(`
    INSERT INTO content_documents (path, json, updated_at, source)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      json = excluded.json,
      updated_at = excluded.updated_at,
      source = excluded.source
  `).run(key, json, new Date().toISOString(), source);

  const filePath = contentPath(key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, json, "utf-8");
}
