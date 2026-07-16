// Shared Google Drive API v3 utilities for sync scripts.
// Importing this module automatically loads .env.local so GOOGLE_API_KEY
// is available without each script having to handle it explicitly.
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  const text = fs.readFileSync(path.join(root, ".env.local"), "utf-8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env.local not present — rely on shell environment
}

function getApiKey() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY is not set. Add it to .env.local or the system environment.\n" +
        "Create one at https://console.cloud.google.com/apis/credentials with the Google Drive API enabled.",
    );
  }
  return apiKey;
}

async function fetchDriveDownload(fileId, options = {}) {
  const params = new URLSearchParams({ alt: "media", key: getApiKey() });
  const apiUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`;
  const apiResponse = await fetch(apiUrl, { signal: AbortSignal.timeout(2 * 60 * 1000), ...options });
  if (apiResponse.ok) return apiResponse;

  // Publicly shared binary files can allow browser downloads while rejecting
  // API-key-only alt=media requests. Use the same public download path a user gets.
  if (apiResponse.status === 401 || apiResponse.status === 403) {
    await apiResponse.body?.cancel();
    const publicUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
    return fetch(publicUrl, { signal: AbortSignal.timeout(2 * 60 * 1000), ...options });
  }
  return apiResponse;
}

/**
 * Download a Drive file's raw bytes via the Drive API v3 alt=media endpoint.
 * Returns a Buffer, or throws on HTTP error.
 */
export async function downloadDriveFile(fileId) {
  const res = await fetchDriveDownload(fileId);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API download error ${res.status} for file ${fileId}: ${body.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Stream a large Drive file to disk without buffering the entire file in memory. */
export async function downloadDriveFileToPath(fileId, destination) {
  const res = await fetchDriveDownload(fileId, {
    signal: AbortSignal.timeout(15 * 60 * 1000),
  });
  if (!res.ok || !res.body) {
    const body = await res.text();
    throw new Error(`Drive API download error ${res.status} for file ${fileId}: ${body.slice(0, 200)}`);
  }
  const partial = `${destination}.part`;
  try {
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(partial));
    fs.renameSync(partial, destination);
  } catch (error) {
    fs.rmSync(partial, { force: true });
    throw error;
  }
}

/** Stream a publicly shared Drive file directly, avoiding an API-key 403 round trip. */
export async function downloadPublicDriveFileToPath(fileId, destination) {
  const url = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15 * 60 * 1000) });
  if (!res.ok || !res.body) {
    const body = await res.text();
    throw new Error(`Public Drive download error ${res.status} for file ${fileId}: ${body.slice(0, 200)}`);
  }
  const partial = `${destination}.part`;
  try {
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(partial));
    fs.renameSync(partial, destination);
  } catch (error) {
    fs.rmSync(partial, { force: true });
    throw error;
  }
}

/**
 * Pause between bulk downloads to avoid triggering Google's IP-based rate limiter.
 */
export function driveDownloadDelay(ms = 400) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * List all non-trashed items directly inside a Drive folder.
 * Returns raw Drive API file objects: { id, name, mimeType }.
 * Follows nextPageToken so all items are returned regardless of folder size.
 */
export async function listDriveItems(folderId) {
  const apiKey = getApiKey();
  const items = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
      pageSize: "1000",
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      signal: AbortSignal.timeout(60 * 1000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Drive API error ${res.status} for folder ${folderId}: ${body}`);
    }
    const data = await res.json();
    items.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}
