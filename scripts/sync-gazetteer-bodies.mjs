// Sync gazetteer settlement docs into BOTH surfaces that need them:
//   1. content/gazetteer-bodies/<slug>.md  -> the /gazetteer/[slug] detail page
//   2. apps/web/brain-vault/wiki/gazetteer/<Title>.md -> Myra's search index
// so Myra knows every city and everything in it (districts, NPCs, taverns,
// shops), plus the Advents Guide ratings for each place. Then rebuilds the
// brain index.
//
// The Markdown export embeds images as huge base64 data URIs (a ~1 MB doc
// becomes ~90 KB once stripped), so image data is dropped; headings, prose,
// lists, and tables are kept.
//
// The gazetteer GRID page is intentionally left untouched.
//
// Run manually:  node scripts/sync-gazetteer-bodies.mjs [--no-index]
// Scheduled:     content-scheduler job `gazetteer-bodies` (daily, after gazetteer)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getDb } from "./sync-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentOutDir = path.join(root, "content", "gazetteer-bodies");
const vaultGazDir = path.join(root, "apps", "web", "brain-vault", "wiki", "gazetteer");
const indexerPath = path.join(root, "apps", "web", "brain-tools", "src", "indexer.mjs");

const noIndex = process.argv.includes("--no-index");
const MIN_BODY_CHARS = 400;
const FETCH_TIMEOUT_MS = 45_000;

function docIdFrom(url) {
  if (!url) return null;
  return /document\/d\/([\w-]+)/.exec(url)?.[1] ?? null;
}

function cleanMarkdown(md) {
  let t = md.replace(/^﻿/, "");
  t = t.replace(/!\[[^\]]*\]\(data:image[^)]*\)/g, "");
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  t = t.replace(/^\s*\[[^\]]*\]:\s*<?data:image[^\n]*$/gim, "");
  t = t.replace(/^\s*data:image[^\n]*$/gim, "");
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

// --- Advents Guide ratings ---------------------------------------------------

function loadRatings(db) {
  const subjects = db
    .prepare(
      `SELECT s.id, s.kind, s.map_location_id AS loc, s.name,
              COUNT(r.id) AS n, ROUND(AVG(r.rating), 1) AS avg
       FROM advents_guide_subjects s
       LEFT JOIN advents_guide_reviews r ON r.subject_id = s.id AND r.censored = 0
       GROUP BY s.id`,
    )
    .all();
  const reviewsBySubject = new Map();
  for (const row of db
    .prepare(`SELECT subject_id, character_name, rating, comment FROM advents_guide_reviews WHERE censored = 0`)
    .all()) {
    if (!reviewsBySubject.has(row.subject_id)) reviewsBySubject.set(row.subject_id, []);
    reviewsBySubject.get(row.subject_id).push(row);
  }
  // Group by map location id.
  const byLocation = new Map();
  for (const s of subjects) {
    if (!byLocation.has(s.loc)) byLocation.set(s.loc, { location: null, businesses: [] });
    const bucket = byLocation.get(s.loc);
    const entry = { ...s, reviews: reviewsBySubject.get(s.id) ?? [] };
    if (s.kind === "location") bucket.location = entry;
    else bucket.businesses.push(entry);
  }
  return byLocation;
}

function stars(avg) {
  return typeof avg === "number" ? `${avg.toFixed(1)} out of 5` : "unrated";
}

function ratingsSection(cityName, bucket) {
  if (!bucket) return "";
  const lines = [];
  const loc = bucket.location;
  const rated = bucket.businesses.filter((b) => b.n > 0);
  if ((!loc || loc.n === 0) && rated.length === 0) return "";

  lines.push("");
  lines.push("## Advents Guide Ratings");
  lines.push("");
  lines.push(
    "Player ratings from the Advents Guide to Myrdae (in-character reviews, 1 to 5 stars).",
  );
  lines.push("");
  if (loc && loc.n > 0) {
    lines.push(`- **${cityName}** (overall location): ${stars(loc.avg)} from ${loc.n} review${loc.n === 1 ? "" : "s"}.`);
  }
  for (const b of rated) {
    lines.push(`- **${b.name}** (${b.kind}): ${stars(b.avg)} from ${b.n} review${b.n === 1 ? "" : "s"}.`);
  }
  const comments = [];
  for (const s of [loc, ...bucket.businesses].filter(Boolean)) {
    for (const r of s.reviews) {
      if (r.comment && r.comment.trim()) {
        comments.push(`- ${s.name}: "${r.comment.trim()}" — ${r.character_name} (${r.rating} stars)`);
      }
    }
  }
  if (comments.length) {
    lines.push("");
    lines.push("Recent reviews:");
    lines.push(...comments.slice(0, 12));
  }
  lines.push("");
  return lines.join("\n");
}

function buildGlobalRatingsPage(byLocation) {
  const lines = [
    "---",
    'title: "Advents Guide Ratings (All Settlements)"',
    'campaign: "World"',
    "visibility: players",
    "tags: [gazetteer, ratings, advents-guide, auto-curated]",
    "---",
    "",
    "# Advents Guide Ratings — All Settlements",
    "",
    "Player star ratings (1 to 5) from the Advents Guide to Myrdae, grouped by settlement. Only places with at least one review are listed.",
    "",
  ];
  const locNames = [...byLocation.keys()].sort();
  let any = false;
  for (const loc of locNames) {
    const bucket = byLocation.get(loc);
    const rated = bucket.businesses.filter((b) => b.n > 0);
    const hasLoc = bucket.location && bucket.location.n > 0;
    if (!hasLoc && rated.length === 0) continue;
    any = true;
    const cityName = bucket.location?.name ?? loc;
    lines.push(`## ${cityName}`);
    if (hasLoc) lines.push(`- Overall: ${stars(bucket.location.avg)} from ${bucket.location.n} review(s).`);
    for (const b of rated) lines.push(`- ${b.name} (${b.kind}): ${stars(b.avg)} from ${b.n} review(s).`);
    lines.push("");
  }
  if (!any) lines.push("_No ratings have been submitted yet._");
  return lines.join("\n");
}

function frontmatter(title) {
  return [
    "---",
    `title: "${title.replace(/"/g, '\\"')} (Gazetteer)"`,
    'campaign: "World"',
    "visibility: players",
    "tags: [gazetteer, settlement, auto-curated]",
    "---",
    "",
  ].join("\n");
}

// Write only when content actually changed, so unchanged settlements don't bump
// file mtimes (which would force a needless index rebuild every day).
function writeIfChanged(filePath, content) {
  try {
    if (fs.readFileSync(filePath, "utf8") === content) return false;
  } catch { /* new file */ }
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

function loadEntries(db) {
  const cols = new Set(db.prepare("PRAGMA table_info(gazetteer)").all().map((r) => r.name));
  if (!cols.has("slug")) return [];
  const refCol = cols.has("reference_url") ? "reference_url" : "doc_url";
  return db
    .prepare(`SELECT slug, title, ${refCol} AS ref, doc_url AS docUrl FROM gazetteer WHERE slug IS NOT NULL`)
    .all();
}

function runIndexer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [indexerPath], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`indexer exited ${code}`))));
  });
}

async function main() {
  fs.mkdirSync(contentOutDir, { recursive: true });
  fs.mkdirSync(vaultGazDir, { recursive: true });

  const db = getDb();
  const entries = loadEntries(db);
  const ratings = loadRatings(db);

  if (entries.length === 0) {
    console.log("[gazetteer-bodies] No gazetteer entries found; nothing to do.");
    return;
  }

  const byDoc = new Map();
  let written = 0;
  let changedVault = 0;
  let skipped = 0;
  const failures = [];

  for (const entry of entries) {
    const docId = docIdFrom(entry.ref) ?? docIdFrom(entry.docUrl);
    if (!docId) { skipped += 1; continue; }
    try {
      let body = byDoc.get(docId);
      if (body === undefined) {
        body = cleanMarkdown(await fetchDocMarkdown(docId));
        byDoc.set(docId, body);
      }
      if (!body || body.length < MIN_BODY_CHARS) { skipped += 1; continue; }

      const rating = ratingsSection(entry.title, ratings.get(entry.slug));
      const composed = rating ? `${body}\n${rating}` : body;

      // Detail page copy.
      const c1 = writeIfChanged(path.join(contentOutDir, `${path.basename(entry.slug)}.md`), composed);
      // Myra / brain-index copy (frontmatter so it is scoped + player-visible).
      const safeTitle = entry.title.replace(/[<>:"/\\|?* -]/g, "-").trim() || entry.slug;
      const c2 = writeIfChanged(
        path.join(vaultGazDir, `${safeTitle}.md`),
        `${frontmatter(entry.title)}# ${entry.title}\n\n${composed}\n`,
      );
      written += 1;
      if (c1 || c2) changedVault += 1;
      console.log(`[gazetteer-bodies] ${entry.slug} <- doc ${docId.slice(0, 8)} (${composed.length} chars${rating ? ", +ratings" : ""})${c1 || c2 ? "" : " [unchanged]"}`);
    } catch (error) {
      failures.push(`${entry.slug}: ${error.message}`);
    }
  }

  // Global ratings page (covers every rated settlement, including map-only ones).
  if (writeIfChanged(path.join(vaultGazDir, "Advents Guide Ratings.md"), buildGlobalRatingsPage(ratings))) changedVault += 1;

  console.log(`[gazetteer-bodies] Wrote ${written} settlements (${changedVault} changed), skipped ${skipped}, failed ${failures.length}.`);
  if (failures.length) console.log(`[gazetteer-bodies] Failures:\n- ${failures.join("\n- ")}`);

  if (changedVault > 0 && !noIndex) {
    console.log(`[gazetteer-bodies] Rebuilding brain index (${changedVault} page(s) changed)...`);
    await runIndexer();
  } else if (!noIndex) {
    console.log("[gazetteer-bodies] No settlement pages changed; skipping reindex.");
  }

  if (written === 0 && failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("[gazetteer-bodies] Fatal:", error);
  process.exit(1);
});
