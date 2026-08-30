// Fetch each gazetteer settlement doc's Markdown body and store a cleaned copy
// under content/gazetteer-bodies/<slug>.md for the /gazetteer/[slug] detail page.
//
// The gazetteer GRID page is intentionally left untouched. This only produces
// the body files the detail route renders. The Markdown export embeds images as
// giant base64 data URIs (a ~1 MB doc becomes ~90 KB once stripped), so we drop
// all image data and keep headings, prose, lists, and tables.
//
// Run manually:  node scripts/sync-gazetteer-bodies.mjs
// Scheduled:     content-scheduler job `gazetteer-bodies` (daily, after gazetteer)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./sync-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "content", "gazetteer-bodies");

const MIN_BODY_CHARS = 400;         // reject a doc that came back tiny / as a login page
const FETCH_TIMEOUT_MS = 45_000;

function docIdFrom(url) {
  if (!url) return null;
  return /document\/d\/([\w-]+)/.exec(url)?.[1] ?? null;
}

function cleanMarkdown(md) {
  let t = md.replace(/^﻿/, "");
  // Strip inline base64 images: ![alt](data:image/...;base64,AAAA...). base64 has no ")".
  t = t.replace(/!\[[^\]]*\]\(data:image[^)]*\)/g, "");
  // Strip any other inline images (heraldry is shown separately on the page).
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  // Strip reference-style image definitions pointing at data URIs.
  t = t.replace(/^\s*\[[^\]]*\]:\s*<?data:image[^\n]*$/gim, "");
  // Drop any stray lines that are just a data URI.
  t = t.replace(/^\s*data:image[^\n]*$/gim, "");
  // Collapse 3+ blank lines.
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

async function fetchDocMarkdown(docId) {
  const url = `https://docs.google.com/document/d/${docId}/export?format=md`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: "follow", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (/<html[\s>]/i.test(text.slice(0, 500))) throw new Error("got HTML (doc not link-viewable?)");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function loadEntries() {
  const db = getDb();
  const cols = new Set(db.prepare("PRAGMA table_info(gazetteer)").all().map((r) => r.name));
  if (!cols.has("slug")) return [];
  const refCol = cols.has("reference_url") ? "reference_url" : "doc_url";
  return db
    .prepare(`SELECT slug, title, ${refCol} AS ref, doc_url AS docUrl FROM gazetteer WHERE slug IS NOT NULL`)
    .all();
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const entries = loadEntries();
  if (entries.length === 0) {
    console.log("[gazetteer-bodies] No gazetteer entries found; nothing to do.");
    return;
  }

  const byDoc = new Map(); // docId -> cleaned markdown (cache so shared docs fetch once)
  let written = 0;
  let skipped = 0;
  const failures = [];

  for (const entry of entries) {
    const docId = docIdFrom(entry.ref) ?? docIdFrom(entry.docUrl);
    if (!docId) { skipped += 1; continue; }

    try {
      let body = byDoc.get(docId);
      if (body === undefined) {
        const raw = await fetchDocMarkdown(docId);
        body = cleanMarkdown(raw);
        byDoc.set(docId, body);
      }
      if (!body || body.length < MIN_BODY_CHARS) {
        skipped += 1;
        continue;
      }
      const outPath = path.join(outDir, `${path.basename(entry.slug)}.md`);
      fs.writeFileSync(outPath, body, "utf8");
      written += 1;
      console.log(`[gazetteer-bodies] ${entry.slug} <- doc ${docId.slice(0, 8)} (${body.length} chars)`);
    } catch (error) {
      failures.push(`${entry.slug}: ${error.message}`);
    }
  }

  console.log(`[gazetteer-bodies] Done. Wrote ${written}, skipped ${skipped}, failed ${failures.length}.`);
  if (failures.length) console.log(`[gazetteer-bodies] Failures:\n- ${failures.join("\n- ")}`);
  // Only fail loudly if nothing at all could be written (systemic problem).
  if (written === 0 && failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("[gazetteer-bodies] Fatal:", error);
  process.exit(1);
});
