import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";

export function contentDir() {
  if (process.env.SUWANEE_CONTENT_DIR) {
    return process.env.SUWANEE_CONTENT_DIR;
  }

  const candidates = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), "content"),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "../../content"),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "content");
}

export function contentPath(filename: string) {
  return path.join(contentDir(), filename);
}

function normalizeContentKey(filename: string) {
  return filename.replaceAll("\\", "/").replace(/^\/+/, "");
}

export function readContentJson(filename: string): string {
  const key = normalizeContentKey(filename);
  try {
    const row = getDb()
      .prepare(`SELECT json FROM content_documents WHERE path = ?`)
      .get(key) as { json: string } | undefined;
    if (row?.json) return row.json;
  } catch (err) {
    console.error(`[contentFiles] DB read failed for "${key}", falling back to JSON file:`, err);
  }

  return fs.readFileSync(contentPath(key), "utf-8");
}

export function readContent<T>(filename: string): T {
  return JSON.parse(readContentJson(filename)) as T;
}

export function writeContent(filename: string, data: unknown): void {
  const key = normalizeContentKey(filename);
  const json = JSON.stringify(data, null, 2) + "\n";
  const filePath = contentPath(key);

  getDb()
    .prepare(
      `INSERT INTO content_documents (path, json, updated_at, source)
       VALUES (?, ?, ?, 'app')
       ON CONFLICT(path) DO UPDATE SET
         json = excluded.json,
         updated_at = excluded.updated_at,
         source = excluded.source`,
    )
    .run(key, json, new Date().toISOString());

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, json, "utf-8");
}
