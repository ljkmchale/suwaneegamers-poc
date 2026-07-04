import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { parseFrontmatter, titleFromMarkdown } from "./markdown.mjs";
import { getProcessedStatus, markRawSourceProcessed } from "./processed-sources.mjs";

export async function processPendingRawSources(options = {}) {
  const filenameFilter = options.filename ? new Set([path.basename(options.filename)]) : null;
  const dryRun = Boolean(options.dryRun);
  const includeCurrent = Boolean(options.includeCurrent);
  const statuses = await getProcessedStatus();
  const sourceLookup = await loadSourceLookup();
  const candidates = statuses.filter((item) => {
    const filename = path.basename(item.rawFile);
    if (filenameFilter && !filenameFilter.has(filename)) return false;
    return includeCurrent || item.status === "unprocessed" || item.status === "stale";
  });

  const processed = [];
  const skipped = [];

  for (const item of candidates) {
    const filename = path.basename(item.rawFile);
    const source = sourceLookup.get(filename);
    if (!source) {
      skipped.push({ rawFile: item.rawFile, reason: "not configured in google-doc-sources.json" });
      continue;
    }

    if (dryRun) {
      processed.push({
        rawFile: item.rawFile,
        status: item.status,
        page: wikiSourceRelativePath(source)
      });
      continue;
    }

    const result = await processRawSource({ item, source });
    processed.push(result);
  }

  return { processed, skipped };
}

async function processRawSource({ item, source }) {
  const filename = path.basename(item.rawFile);
  const rawPath = path.join(config.vaultRoot, "raw", filename);
  const rawMarkdown = await fs.readFile(rawPath, "utf8");
  const pageRelativePath = wikiSourceRelativePath(source);
  const pagePath = path.join(config.vaultRoot, ...pageRelativePath.split("/"));
  const pageMarkdown = buildSourcePage({ source, item, rawMarkdown });

  await writeFileAtomically(pagePath, pageMarkdown);
  const written = await fs.readFile(pagePath, "utf8");
  if (!written.includes(item.rawContentHash)) {
    throw new Error(`Processed page verification failed for ${pageRelativePath}.`);
  }

  const receipt = await markRawSourceProcessed({
    filename,
    pages: [pageRelativePath],
    notes: `Automatically staged raw source into ${pageRelativePath}.`
  });

  return {
    rawFile: item.rawFile,
    page: pageRelativePath,
    receiptFile: item.receiptFile,
    rawContentHash: receipt.rawContentHash
  };
}

function buildSourcePage({ source, item, rawMarkdown }) {
  const { body } = parseFrontmatter(rawMarkdown);
  const fallbackTitle = titleFromMarkdown(body, source.filename);
  const title = source.title || fallbackTitle;
  const pulled = extractPulledTimestamp(body);
  const importedAt = new Date().toISOString();

  return [
    "---",
    `title: "${yamlString(title)}"`,
    `campaign: "${yamlString(source.campaign || "All")}"`,
    "visibility: players",
    "tags: [source, google-doc, player-notes]",
    `source_raw: "raw/${yamlString(source.filename)}"`,
    `source_url: "${yamlString(source.url)}"`,
    `source_hash: "${item.rawContentHash}"`,
    "source_status: processed",
    `raw_status_before_import: "${item.status}"`,
    `imported_at: "${importedAt}"`,
    pulled ? `pulled_at: "${yamlString(pulled)}"` : null,
    "---",
    "",
    `# ${title}`,
    "",
    `Campaign: ${source.campaign || "All"}`,
    `Source: [Google Doc](${source.url})`,
    `Raw source: [[raw/${source.filename}]]`,
    `Raw hash: \`${item.rawContentHash}\``,
    `Imported: ${importedAt}`,
    "",
    "## Imported Notes",
    "",
    body.trim(),
    ""
  ].filter((line) => line !== null).join("\n");
}

async function loadSourceLookup() {
  let raw;
  try {
    raw = await fs.readFile(config.googleDocSourcesPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }

  const parsed = JSON.parse(raw);
  const sources = Array.isArray(parsed) ? parsed : parsed.sources;
  const lookup = new Map();
  if (!Array.isArray(sources)) return lookup;

  for (const source of sources) {
    if (!source || source.enabled === false || !source.filename) continue;
    lookup.set(path.basename(source.filename), {
      campaign: String(source.campaign ?? "").trim(),
      title: String(source.title ?? "").trim(),
      url: String(source.url ?? "").trim(),
      filename: path.basename(String(source.filename).trim())
    });
  }
  return lookup;
}

function wikiSourceRelativePath(source) {
  const campaign = sanitizePathSegment(source.campaign || "All");
  const title = sanitizePathSegment(source.title || path.basename(source.filename, path.extname(source.filename)));
  return `wiki/sources/${campaign}/${title}.md`;
}

function sanitizePathSegment(value) {
  return String(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .trim() || "Untitled";
}

function extractPulledTimestamp(markdown) {
  const match = markdown.match(/^Pulled:\s*(.+)$/m);
  return match?.[1]?.trim() ?? "";
}

function yamlString(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

async function writeFileAtomically(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
}
