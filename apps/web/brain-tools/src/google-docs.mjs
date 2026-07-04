import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { config } from "./config.mjs";
import { exportGoogleDocText } from "./drive-api.mjs";

const googleDocIdPattern = /^[a-zA-Z0-9_-]{20,}$/;

export function extractGoogleDocId(input) {
  const value = String(input ?? "").trim();
  if (!value) return "";

  const documentMatch = value.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (documentMatch) return documentMatch[1];

  const openMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  if (googleDocIdPattern.test(value)) return value;
  return "";
}

export async function pullGoogleDocToRaw({ url, title, filename, overwrite = false }) {
  const docId = extractGoogleDocId(url);
  if (!docId) {
    const error = new Error("Enter a valid Google Docs URL or document ID.");
    error.statusCode = 400;
    throw error;
  }

  const { sourceUrl, text } = await fetchGoogleDocText(docId);
  const result = await writeGoogleDocTextToRaw({ docId, sourceUrl, text, title, filename, overwrite });
  await upsertSourceRegistry({ title: result.title, sourceUrl, filename: result.filename });
  return result;
}

export async function fetchGoogleDocText(input) {
  const docId = extractGoogleDocId(input);
  if (!docId) {
    const error = new Error("Enter a valid Google Docs URL or document ID.");
    error.statusCode = 400;
    throw error;
  }

  const sourceUrl = `https://docs.google.com/document/d/${docId}/edit`;
  const text = await exportGoogleDocText(docId);
  return { docId, sourceUrl, text };
}

export function hashGoogleDocText(text) {
  return createHash("sha256").update(normalizeGoogleDocText(text)).digest("hex");
}

export async function writeGoogleDocTextToRaw({ docId, sourceUrl, text, title, filename, overwrite = false }) {
  const contentHash = hashGoogleDocText(text);
  const normalizedText = normalizeGoogleDocText(text);

  const cleanTitle = sanitizeTitle(title) || inferTitleFromFilename(filename) || `Google Doc ${docId.slice(0, 8)}`;
  const safeFilename = sanitizeFilename(filename || cleanTitle) || `${docId}.md`;
  const finalFilename = safeFilename.toLowerCase().endsWith(".md") ? safeFilename : `${safeFilename}.md`;
  const rawDir = path.resolve(config.vaultRoot, "raw");
  const destinationPath = path.resolve(rawDir, finalFilename);

  if (!isInside(rawDir, destinationPath)) {
    const error = new Error("Invalid destination filename.");
    error.statusCode = 400;
    throw error;
  }

  let existingText = "";
  let existingHash = "";
  let hasExisting = false;
  try {
    await fs.access(destinationPath);
    hasExisting = true;
    if (!overwrite) {
      const error = new Error(`${finalFilename} already exists in raw/. Check overwrite to replace it.`);
      error.statusCode = 409;
      throw error;
    }
    existingText = await fs.readFile(destinationPath, "utf8");
    existingHash = createHash("sha256").update(existingText).digest("hex");
  } catch (error) {
    if (error.statusCode) throw error;
    if (error.code !== "ENOENT") throw error;
  }

  assertSafeRawPull({ text: normalizedText, existingText, hasExisting, filename: finalFilename });

  const markdown = [
    `# ${cleanTitle}`,
    "",
    `Source: [Google Doc](${sourceUrl})`,
    `Pulled: ${new Date().toISOString()}`,
    "",
    normalizedText,
    ""
  ].join("\n");

  let backup = null;
  if (hasExisting) {
    backup = await backupRawFile({ rawDir, destinationPath, filename: finalFilename, existingHash });
  }

  await fs.writeFile(destinationPath, markdown, "utf8");

  return {
    title: cleanTitle,
    docId,
    filename: finalFilename,
    relativePath: `raw/${finalFilename}`,
    characterCount: text.length,
    contentHash,
    backup
  };
}

export async function upsertSourceRegistry({ title, sourceUrl, filename }) {
  const registryPath = path.resolve(config.vaultRoot, "raw", "_sources.md");
  let registry = "";
  try {
    registry = await fs.readFile(registryPath, "utf8");
  } catch {
    registry = "# Sources\n\n## Known Sources\n\n| Source | Type | External Link | Local File |\n|---|---|---|---|\n";
  }

  const row = `| ${escapeTableCell(title)} | Google Doc | ${sourceUrl} | raw/${escapeTableCell(filename)} |`;
  const lines = registry.split(/\r?\n/);
  const existingIndex = lines.findIndex((line) => line.includes(sourceUrl) || line.endsWith(`| raw/${filename} |`));
  if (existingIndex >= 0) {
    lines[existingIndex] = row;
    await fs.writeFile(registryPath, lines.join("\n"), "utf8");
    return;
  }

  const tableHeaderIndex = lines.findIndex((line) => line.trim() === "| Source | Type | External Link | Local File |");
  if (tableHeaderIndex >= 0) {
    let insertAt = tableHeaderIndex + 2;
    while (insertAt < lines.length && lines[insertAt].trim().startsWith("|")) insertAt += 1;
    lines.splice(insertAt, 0, row);
    await fs.writeFile(registryPath, lines.join("\n"), "utf8");
    return;
  }

  const appended = registry.trimEnd() + "\n\n## Known Sources\n\n| Source | Type | External Link | Local File |\n|---|---|---|---|\n" + row + "\n";
  await fs.writeFile(registryPath, appended, "utf8");
}

function sanitizeTitle(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
}

function inferTitleFromFilename(value) {
  const base = String(value ?? "").trim().replace(/\.md$/i, "");
  if (!base) return "";
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeFilename(value) {
  return String(value ?? "")
    .trim()
    .replace(/\.md$/i, "")
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function escapeTableCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function normalizeGoogleDocText(text) {
  return String(text ?? "").replace(/\r\n/g, "\n").trim();
}

function assertSafeRawPull({ text, existingText, hasExisting, filename }) {
  if (text.length < config.rawPullMinChars) {
    const error = new Error(`${filename} pull looked too small (${text.length} chars). Raw file was not overwritten.`);
    error.statusCode = 422;
    throw error;
  }

  if (!hasExisting) return;

  const existingBody = stripRawExportMetadata(existingText);
  if (existingBody.length < config.rawPullMinChars) return;

  const minRatio = Math.max(0, Math.min(1, config.rawPullMinSizeRatio));
  if (text.length < existingBody.length * minRatio) {
    const error = new Error(`${filename} pull shrank from ${existingBody.length} chars to ${text.length} chars. Raw file was not overwritten.`);
    error.statusCode = 422;
    throw error;
  }
}

function stripRawExportMetadata(markdown) {
  return String(markdown ?? "")
    .replace(/^# .*\n+Source:.*\n+Pulled:.*\n+/s, "")
    .trim();
}

async function backupRawFile({ rawDir, destinationPath, filename, existingHash }) {
  const sourceName = path.basename(filename, path.extname(filename));
  const historyDir = path.join(rawDir, ".history", sourceName);
  await fs.mkdir(historyDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFilename = `${timestamp}-${filename}`;
  const backupPath = path.join(historyDir, backupFilename);
  await fs.copyFile(destinationPath, backupPath);
  await pruneRawHistory(historyDir);

  return {
    path: normalizeRelative(path.relative(config.vaultRoot, backupPath)),
    previousHash: existingHash
  };
}

async function pruneRawHistory(historyDir) {
  const keep = Math.max(1, config.rawHistoryKeep);
  const entries = await fs.readdir(historyDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(historyDir, entry.name);
    const stat = await fs.stat(filePath);
    files.push({ filePath, mtimeMs: stat.mtimeMs });
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const file of files.slice(keep)) {
    await fs.unlink(file.filePath);
  }
}

function normalizeRelative(value) {
  return String(value).replaceAll(path.sep, "/");
}

function isInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
