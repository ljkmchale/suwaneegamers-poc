import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { config } from "./config.mjs";

export async function markRawSourceProcessed({ filename, status = "processed", pages = [], notes = "" }) {
  const rawPath = rawSourcePath(filename);
  const stat = await fs.stat(rawPath);
  if (!stat.isFile()) {
    throw new Error(`${filename} is not a raw source file.`);
  }

  const rawContentHash = await hashFile(rawPath);
  const rawRelativePath = normalizeRelative(path.relative(config.vaultRoot, rawPath));
  const receipt = {
    version: 1,
    rawFile: rawRelativePath,
    rawContentHash,
    status: normalizeStatus(status),
    processedAt: new Date().toISOString(),
    pagesUpdated: pages.map((page) => String(page).trim()).filter(Boolean),
    notes: String(notes ?? "").trim()
  };

  await fs.mkdir(config.processedRoot, { recursive: true });
  const receiptPath = processedReceiptPath(filename);
  await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  return receipt;
}

export async function getProcessedStatus() {
  const rawDir = path.join(config.vaultRoot, "raw");
  let files = [];
  try {
    files = await fs.readdir(rawDir);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const rawFiles = files
    .filter((file) => file.toLowerCase().endsWith(".md") && file !== "_sources.md")
    .sort((a, b) => a.localeCompare(b));

  const statuses = [];
  for (const file of rawFiles) {
    const rawPath = path.join(rawDir, file);
    const rawContentHash = await hashFile(rawPath);
    const receipt = await readReceipt(file);
    const processedHash = receipt?.rawContentHash ?? "";
    const current = Boolean(receipt && processedHash === rawContentHash && receipt.status === "processed");

    statuses.push({
      rawFile: `raw/${file}`,
      receiptFile: `processed/${receiptFilename(file)}`,
      status: !receipt ? "unprocessed" : current ? "current" : "stale",
      ingestStatus: receipt?.status ?? "missing",
      rawContentHash,
      processedHash,
      processedAt: receipt?.processedAt ?? null,
      pagesUpdated: receipt?.pagesUpdated ?? []
    });
  }

  return statuses;
}

export async function hashFile(filePath) {
  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function rawSourcePath(filename) {
  const rawDir = path.join(config.vaultRoot, "raw");
  const resolved = path.resolve(rawDir, filename);
  if (!isInside(rawDir, resolved)) {
    throw new Error("Invalid raw source filename.");
  }
  return resolved;
}

function processedReceiptPath(filename) {
  const resolved = path.resolve(config.processedRoot, receiptFilename(filename));
  if (!isInside(config.processedRoot, resolved)) {
    throw new Error("Invalid processed receipt filename.");
  }
  return resolved;
}

function receiptFilename(filename) {
  return `${path.basename(filename, path.extname(filename))}.json`;
}

async function readReceipt(filename) {
  try {
    return JSON.parse(await fs.readFile(processedReceiptPath(filename), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function normalizeStatus(status) {
  const value = String(status ?? "").trim().toLowerCase();
  if (["processed", "partial", "needs-review"].includes(value)) return value;
  return "processed";
}

function normalizeRelative(value) {
  return String(value).replaceAll(path.sep, "/");
}

function isInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
