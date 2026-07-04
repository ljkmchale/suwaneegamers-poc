import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { brainConfig } from "./config";

// ─── Drive API ───────────────────────────────────────────────────────────────

async function exportGoogleDocText(docId: string): Promise<string> {
  const apiKey = brainConfig.googleApiKey;
  if (!apiKey) {
    const error = new Error(
      "GOOGLE_API_KEY is not set. Add it to the SG .env.local file with the Google Drive API enabled.",
    );
    (error as NodeJS.ErrnoException & { statusCode?: number }).statusCode = 500;
    throw error;
  }

  const params = new URLSearchParams({ mimeType: "text/plain", key: apiKey });
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/export?${params}`,
  );

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = `: ${body.error.message}`;
    } catch {
      // ignore parse error
    }
    const err = new Error(
      `Drive API export failed with HTTP ${response.status}${detail}. Make sure link sharing is enabled on the Google Doc.`,
    ) as Error & { statusCode?: number };
    err.statusCode = response.status === 404 ? 404 : 502;
    throw err;
  }

  const text = await response.text();
  if (!text.trim()) {
    const err = new Error("Drive API returned an empty document.") as Error & { statusCode?: number };
    err.statusCode = 422;
    throw err;
  }
  return text;
}

// ─── Google Docs helpers ──────────────────────────────────────────────────────

const googleDocIdPattern = /^[a-zA-Z0-9_-]{20,}$/;

export function extractGoogleDocId(input: unknown): string {
  const value = String(input ?? "").trim();
  if (!value) return "";

  const documentMatch = value.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (documentMatch) return documentMatch[1];

  const openMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  if (googleDocIdPattern.test(value)) return value;
  return "";
}

export function hashGoogleDocText(text: string): string {
  return createHash("sha256").update(normalizeGoogleDocText(text)).digest("hex");
}

export async function fetchGoogleDocText(input: unknown): Promise<{ docId: string; sourceUrl: string; text: string }> {
  const docId = extractGoogleDocId(input);
  if (!docId) {
    const err = new Error("Enter a valid Google Docs URL or document ID.") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  const sourceUrl = `https://docs.google.com/document/d/${docId}/edit`;
  const text = await exportGoogleDocText(docId);
  return { docId, sourceUrl, text };
}

export interface PullGoogleDocOptions {
  url: string;
  title: string;
  filename: string;
  overwrite?: boolean;
}

export interface PullGoogleDocResult {
  title: string;
  docId: string;
  filename: string;
  relativePath: string;
  characterCount: number;
  contentHash: string;
  backup: { path: string; previousHash: string } | null;
}

export async function pullGoogleDocToRaw({
  url,
  title,
  filename,
  overwrite = false,
}: PullGoogleDocOptions): Promise<PullGoogleDocResult> {
  const docId = extractGoogleDocId(url);
  if (!docId) {
    const err = new Error("Enter a valid Google Docs URL or document ID.") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  const { sourceUrl, text } = await fetchGoogleDocText(docId);
  const result = await writeGoogleDocTextToRaw({ docId, sourceUrl, text, title, filename, overwrite });
  await upsertSourceRegistry({ title: result.title, sourceUrl, filename: result.filename });
  return result;
}

interface WriteOptions {
  docId: string;
  sourceUrl: string;
  text: string;
  title: string;
  filename: string;
  overwrite?: boolean;
}

async function writeGoogleDocTextToRaw({
  docId,
  sourceUrl,
  text,
  title,
  filename,
  overwrite = false,
}: WriteOptions): Promise<PullGoogleDocResult> {
  const contentHash = hashGoogleDocText(text);
  const normalizedText = normalizeGoogleDocText(text);

  const cleanTitle = sanitizeTitle(title) || inferTitleFromFilename(filename) || `Google Doc ${docId.slice(0, 8)}`;
  const safeFilename = sanitizeFilename(filename || cleanTitle) || `${docId}.md`;
  const finalFilename = safeFilename.toLowerCase().endsWith(".md") ? safeFilename : `${safeFilename}.md`;
  const rawDir = path.resolve(brainConfig.vaultRoot, "raw");
  const destinationPath = path.resolve(rawDir, finalFilename);

  if (!isInside(rawDir, destinationPath)) {
    const err = new Error("Invalid destination filename.") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  let existingText = "";
  let existingHash = "";
  let hasExisting = false;
  try {
    await fs.access(destinationPath);
    hasExisting = true;
    if (!overwrite) {
      const err = new Error(
        `${finalFilename} already exists in raw/. Check overwrite to replace it.`,
      ) as Error & { statusCode?: number };
      err.statusCode = 409;
      throw err;
    }
    existingText = await fs.readFile(destinationPath, "utf8");
    existingHash = createHash("sha256").update(existingText).digest("hex");
  } catch (error) {
    const e = error as NodeJS.ErrnoException & { statusCode?: number };
    if (e.statusCode) throw error;
    if (e.code !== "ENOENT") throw error;
  }

  assertSafeRawPull({ text: normalizedText, existingText, hasExisting, filename: finalFilename });

  const markdown = [
    `# ${cleanTitle}`,
    "",
    `Source: [Google Doc](${sourceUrl})`,
    `Pulled: ${new Date().toISOString()}`,
    "",
    normalizedText,
    "",
  ].join("\n");

  let backup: { path: string; previousHash: string } | null = null;
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
    backup,
  };
}

async function upsertSourceRegistry({
  title,
  sourceUrl,
  filename,
}: {
  title: string;
  sourceUrl: string;
  filename: string;
}): Promise<void> {
  const registryPath = path.resolve(brainConfig.vaultRoot, "raw", "_sources.md");
  let registry = "";
  try {
    registry = await fs.readFile(registryPath, "utf8");
  } catch {
    registry =
      "# Sources\n\n## Known Sources\n\n| Source | Type | External Link | Local File |\n|---|---|---|---|\n";
  }

  const row = `| ${escapeTableCell(title)} | Google Doc | ${sourceUrl} | raw/${escapeTableCell(filename)} |`;
  const lines = registry.split(/\r?\n/);
  const existingIndex = lines.findIndex(
    (line) => line.includes(sourceUrl) || line.endsWith(`| raw/${filename} |`),
  );
  if (existingIndex >= 0) {
    lines[existingIndex] = row;
    await fs.writeFile(registryPath, lines.join("\n"), "utf8");
    return;
  }

  const tableHeaderIndex = lines.findIndex(
    (line) => line.trim() === "| Source | Type | External Link | Local File |",
  );
  if (tableHeaderIndex >= 0) {
    let insertAt = tableHeaderIndex + 2;
    while (insertAt < lines.length && lines[insertAt].trim().startsWith("|")) insertAt += 1;
    lines.splice(insertAt, 0, row);
    await fs.writeFile(registryPath, lines.join("\n"), "utf8");
    return;
  }

  const appended =
    registry.trimEnd() +
    "\n\n## Known Sources\n\n| Source | Type | External Link | Local File |\n|---|---|---|---|\n" +
    row +
    "\n";
  await fs.writeFile(registryPath, appended, "utf8");
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function sanitizeTitle(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function inferTitleFromFilename(value: unknown): string {
  const base = String(value ?? "")
    .trim()
    .replace(/\.md$/i, "");
  if (!base) return "";
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeFilename(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\.md$/i, "")
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function escapeTableCell(value: unknown): string {
  return String(value).replaceAll("|", "\\|");
}

function normalizeGoogleDocText(text: unknown): string {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function assertSafeRawPull({
  text,
  existingText,
  hasExisting,
  filename,
}: {
  text: string;
  existingText: string;
  hasExisting: boolean;
  filename: string;
}): void {
  if (text.length < brainConfig.rawPullMinChars) {
    const err = new Error(
      `${filename} pull looked too small (${text.length} chars). Raw file was not overwritten.`,
    ) as Error & { statusCode?: number };
    err.statusCode = 422;
    throw err;
  }

  if (!hasExisting) return;

  const existingBody = stripRawExportMetadata(existingText);
  if (existingBody.length < brainConfig.rawPullMinChars) return;

  const minRatio = Math.max(0, Math.min(1, brainConfig.rawPullMinSizeRatio));
  if (text.length < existingBody.length * minRatio) {
    const err = new Error(
      `${filename} pull shrank from ${existingBody.length} chars to ${text.length} chars. Raw file was not overwritten.`,
    ) as Error & { statusCode?: number };
    err.statusCode = 422;
    throw err;
  }
}

function stripRawExportMetadata(markdown: string): string {
  return String(markdown ?? "")
    .replace(/^# .*\n+Source:.*\n+Pulled:.*\n+/s, "")
    .trim();
}

async function backupRawFile({
  rawDir,
  destinationPath,
  filename,
  existingHash,
}: {
  rawDir: string;
  destinationPath: string;
  filename: string;
  existingHash: string;
}): Promise<{ path: string; previousHash: string }> {
  const sourceName = path.basename(filename, path.extname(filename));
  const historyDir = path.join(rawDir, ".history", sourceName);
  await fs.mkdir(historyDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFilename = `${timestamp}-${filename}`;
  const backupPath = path.join(historyDir, backupFilename);
  await fs.copyFile(destinationPath, backupPath);
  await pruneRawHistory(historyDir);

  return {
    path: normalizeRelative(path.relative(brainConfig.vaultRoot, backupPath)),
    previousHash: existingHash,
  };
}

async function pruneRawHistory(historyDir: string): Promise<void> {
  const keep = Math.max(1, brainConfig.rawHistoryKeep);
  const entries = await fs.readdir(historyDir, { withFileTypes: true });
  const files: { filePath: string; mtimeMs: number }[] = [];

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

function normalizeRelative(value: string): string {
  return String(value).replaceAll(path.sep, "/");
}

function isInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
