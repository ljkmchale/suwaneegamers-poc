import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readContent, writeContent } from "./content-documents.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cachePath = path.join(root, "content", "lore-doc-cache.html");
const html = fs.readFileSync(cachePath, "utf8");
const config = readContent("legends-lore-narrations.json");
config.historian.status = "approved";

function decodeHtml(value) {
  const named = {
    amp: "&", apos: "'", gt: ">", hellip: "...", ldquo: '"', lsquo: "'",
    lt: "<", mdash: "-", nbsp: " ", ndash: "-", Ograve: "O", quot: '"',
    rdquo: '"', rsquo: "'",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-zA-Z]+);/g, (entity, code) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code] ?? entity;
  });
}

function plainText(value) {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h2|li|ul)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
const extracted = [];
for (let index = 0; index < headings.length; index += 1) {
  const title = plainText(headings[index][1]);
  if (!title || /^legends\s*&?\s*lore$/i.test(title)) continue;
  const next = headings[index + 1];
  const bodyStart = headings[index].index + headings[index][0].length;
  const originalText = plainText(html.slice(bodyStart, next?.index ?? html.length));
  if (!originalText) continue;
  extracted.push({ title, originalText });
}

const existingByTitle = new Map(config.entries.map((entry) => [entry.title, entry]));
config.entries = extracted.map(({ title, originalText }) => {
  const existing = existingByTitle.get(title);
  if (existing) {
    return { ...existing, status: "approved", originalText };
  }
  return {
    title,
    status: "approved",
    originalText,
    script: originalText,
    audioUrl: `/media/session-audio/legends-lore/${slugify(title)}-historian.mp3`,
  };
});

writeContent("legends-lore-narrations.json", config, "legends-lore-narration-prep");
console.log(`Prepared ${config.entries.length} Legends & Lore narration records.`);
