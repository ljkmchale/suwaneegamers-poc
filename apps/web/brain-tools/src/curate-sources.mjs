// Curate campaign synthesis pages from the current player-notes sources.
//
// The daily `chronicles-sources` job pulls each campaign's Google Doc into
// `raw/` + `wiki/sources/` (searchable verbatim) but does NOT write the curated
// synthesis pages the vault spec describes - those were a manual agent Ingest
// that lapsed. This script automates the ONE synthesis page that is safe to
// regenerate wholesale each run: the per-campaign Quick Reference (a "living
// document, update after each session" - current status, party, NPCs, factions,
// locations, quests, open threads, recent developments).
//
// SAFETY / CAMPAIGN ISOLATION (the vault's #1 rule - never bleed campaigns):
//   - The LLM returns page CONTENT only. It never chooses a path. Each page is
//     written to a fixed, campaign-scoped path derived here in code, so a
//     cross-campaign write is structurally impossible.
//   - Only the overwrite-safe Quick Reference page is touched. Accumulating
//     per-entity history pages (npcs/, locations/, sessions/) are left alone -
//     they need merge logic that is unsafe to automate unattended.
//   - Each campaign is processed from its own single source in isolation.
//
// INCREMENTAL: a campaign is re-curated only when its raw source hash changed
// since the last run (receipt in processed/), so daily cost is ~one model call
// per changed campaign. `--force` re-curates everything (used for the one-time
// catch-up). `--only "<Campaign>"` limits to one campaign.
//
// Run manually:   node src/curate-sources.mjs [--force] [--only "HoE"] [--no-index] [--dry-run]
// Scheduled:      content-scheduler job `chronicles-curation` (daily, after chronicles-sources)
import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "./config.mjs";

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const noIndex = args.has("--no-index");
const dryRun = args.has("--dry-run");
let onlyCampaign = null;
{
  const idx = process.argv.indexOf("--only");
  if (idx !== -1 && process.argv[idx + 1]) onlyCampaign = process.argv[idx + 1];
}

const MODEL = process.env.CURATION_MODEL || "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_INPUT_CHARS = 700_000; // ~175k tokens; keep the TAIL (recent sessions) if longer
const MAX_OUTPUT_TOKENS = 6000;
const ATTEMPTS = 3;

// --- Anthropic key: loadDotEnv only reads brain-tools/.env, but the key lives in
// the app env files. Resolve it from the environment or the known .env.local files. ---
function resolveAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const repoRoot = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
  const candidates = [
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, "apps", "web", ".env.local"),
    path.join(repoRoot, "apps", "web", "brain-tools", ".env"),
  ];
  for (const file of candidates) {
    let text;
    try { text = fsSync.readFileSync(file, "utf8"); } catch { continue; }
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

const ANTHROPIC_API_KEY = resolveAnthropicKey();

const SYSTEM_PROMPT = [
  "You maintain the Quick Reference synthesis page for ONE Dungeons & Dragons campaign in a campaign-isolated wiki.",
  "You are given that campaign's current player-notes source document. Produce a single, current, fast-lookup reference page.",
  "",
  "HARD RULES:",
  "- Ground every claim strictly in the provided notes. Never invent names, events, dates, or outcomes. If something is unknown, omit it.",
  "- This is ONE campaign. Never mention, infer, or cross-reference any other campaign, party, or character not present in these notes.",
  "- The notes are chronological; the MOST RECENT sessions are at the end and matter most for current status. Reflect the latest known state.",
  "- Prefer specific, cited facts (session numbers, in-game dates, place names) over vague summary.",
  "- Output ONLY the finished Markdown page body. No preamble, no explanation, no code fences.",
].join("\n");

function buildUserPrompt({ campaign, title, notes }) {
  return [
    `Campaign: ${campaign}`,
    `Source document: ${title}`,
    "",
    "Regenerate the Quick Reference page. Use this exact structure, but OMIT any section the notes do not support (do not write \"unknown\"):",
    "",
    "# " + campaign + " Quick Reference",
    "",
    "Campaign: " + campaign,
    "",
    "<one sentence noting this is a living quick-reference kept current from the campaign notes>",
    "",
    "## Current Status  (where the party is now, what is happening, in-game date, at the latest session)",
    "## Active Party Members  (Markdown table: Character | Player | Species | Class | Deity/Notes)",
    "## Former Party Members (Deceased / Departed)  (bullet list with how/when if known)",
    "## Key NPCs  (name - one line each)",
    "## Factions & Organizations",
    "## Key Locations",
    "## Active Quests & Objectives",
    "## Open Threads  (unresolved mysteries/questions)",
    "## Recent Developments  (bulleted, the last several sessions with session numbers)",
    "",
    "=== CAMPAIGN NOTES (verbatim source) ===",
    notes,
  ].join("\n");
}

async function callClaude({ campaign, title, notes }) {
  const body = {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt({ campaign, title, notes }) }],
  };
  let lastErr;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        // 429 / 5xx are retryable; 4xx (bad model/key) are not.
        if (res.status === 429 || res.status >= 500) throw new Error(`retryable ${res.status}: ${detail.slice(0, 300)}`);
        throw Object.assign(new Error(`Anthropic ${res.status}: ${detail.slice(0, 300)}`), { fatal: true });
      }
      const json = await res.json();
      const text = (json.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      if (!text) throw new Error("empty completion");
      return stripFences(text);
    } catch (err) {
      lastErr = err;
      if (err.fatal) break;
      if (attempt < ATTEMPTS) await sleep(1500 * attempt);
    }
  }
  throw lastErr;
}

function stripFences(text) {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```\s*$/, "");
  return t.trim();
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function quickRefRelPath(campaign) {
  return `wiki/quick/${campaign} Quick Reference.md`;
}

function receiptPath(source) {
  const slug = source.filename.replace(/\.md$/i, "");
  return path.join(config.vaultRoot, "processed", `${slug}.quickref-curation.json`);
}

async function readReceipt(source) {
  try { return JSON.parse(await fs.readFile(receiptPath(source), "utf8")); } catch { return null; }
}

function sha256(text) { return createHash("sha256").update(text, "utf8").digest("hex"); }

function frontmatter({ campaign, title, hash, model }) {
  return [
    "---",
    `title: "${campaign} Quick Reference"`,
    `campaign: "${campaign}"`,
    "visibility: players",
    "tags: [quick-reference, synthesis, auto-curated]",
    `source_title: "${title.replace(/"/g, '\\"')}"`,
    `source_hash: "${hash}"`,
    `curated_at: "${new Date().toISOString()}"`,
    `curated_by: "curate-sources.mjs (${model})"`,
    "---",
    "",
  ].join("\n");
}

async function writeAtomically(absPath, content) {
  const dir = path.dirname(absPath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(absPath)}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, absPath);
}

async function appendLog(entries) {
  if (entries.length === 0) return;
  const logPath = path.join(config.vaultRoot, "log.md");
  const date = new Date().toISOString().slice(0, 10);
  const block = [
    "",
    `## [${date}] synthesis | Quick Reference auto-curation`,
    "",
    ...entries.map((e) => `- ${e}`),
    "",
  ].join("\n");
  let existing = "";
  try { existing = await fs.readFile(logPath, "utf8"); } catch { /* new file */ }
  await fs.writeFile(logPath, existing + block, "utf8");
}

async function loadSources() {
  const raw = await fs.readFile(config.googleDocSourcesPath, "utf8");
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed.sources;
  // Skip non-campaign sources (curate:false) - e.g. the World gazetteer docs,
  // which are staged verbatim by refresh-sources but have no per-campaign
  // Quick Reference (and would all collide on one "World Quick Reference" path).
  return list.filter((s) => s && s.enabled !== false && s.curate !== false && s.filename && s.campaign);
}

async function runIndexer() {
  const indexer = fileURLToPath(new URL("./indexer.mjs", import.meta.url));
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [indexer], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`indexer exited ${code}`))));
  });
}

async function main() {
  if (!ANTHROPIC_API_KEY) {
    console.error("[curate] ANTHROPIC_API_KEY not found (env or .env.local). Aborting.");
    process.exit(2);
  }

  let sources = await loadSources();
  if (onlyCampaign) sources = sources.filter((s) => s.campaign === onlyCampaign);
  if (sources.length === 0) {
    console.log("[curate] No matching enabled sources.");
    return;
  }

  const changed = [];
  const logEntries = [];
  const failures = [];

  for (const source of sources) {
    const label = source.campaign;
    const rawPath = path.join(config.vaultRoot, "raw", source.filename);
    let notes;
    try {
      notes = await fs.readFile(rawPath, "utf8");
    } catch {
      console.log(`[curate] ${label}: no raw source at ${path.relative(config.vaultRoot, rawPath)} - skipping.`);
      continue;
    }

    const hash = sha256(notes);
    const receipt = await readReceipt(source);
    if (!force && receipt && receipt.hash === hash) {
      console.log(`[curate] ${label}: unchanged since ${receipt.curatedAt} - skipping.`);
      continue;
    }

    const trimmed = notes.length > MAX_INPUT_CHARS ? notes.slice(notes.length - MAX_INPUT_CHARS) : notes;

    if (dryRun) {
      console.log(`[curate] ${label}: WOULD curate (${notes.length} chars, hash ${hash.slice(0, 12)}).`);
      continue;
    }

    let page;
    try {
      console.log(`[curate] ${label}: calling ${MODEL} (${trimmed.length} chars)...`);
      page = await callClaude({ campaign: source.campaign, title: source.title || source.filename, notes: trimmed });
    } catch (err) {
      const msg = `${label}: model call failed - ${err.message}`;
      console.error(`[curate] ${msg}`);
      failures.push(msg);
      continue;
    }

    // Sanity guard: reject a suspiciously short or off-topic result rather than
    // overwriting a good page with junk.
    const firstToken = source.campaign.toLowerCase().split(" ")[0];
    if (page.length < 200 || !page.toLowerCase().includes(firstToken)) {
      const msg = `${label}: curation output failed sanity check (len ${page.length}) - keeping existing page.`;
      console.error(`[curate] ${msg}`);
      failures.push(msg);
      continue;
    }

    const relPath = quickRefRelPath(source.campaign);
    const absPath = path.join(config.vaultRoot, ...relPath.split("/"));
    const full = frontmatter({ campaign: source.campaign, title: source.title || source.filename, hash, model: MODEL }) + page + "\n";
    await writeAtomically(absPath, full);

    await writeAtomically(receiptPath(source), JSON.stringify({
      campaign: source.campaign,
      source: source.filename,
      page: relPath,
      hash,
      model: MODEL,
      curatedAt: new Date().toISOString(),
    }, null, 2));

    console.log(`[curate] ${label}: wrote ${relPath} (${full.length} chars).`);
    changed.push(source.campaign);
    logEntries.push(`Refreshed [[quick/${source.campaign} Quick Reference]] from current ${source.campaign} notes (${MODEL}).`);
  }

  if (logEntries.length) await appendLog(logEntries);

  if (changed.length && !noIndex && !dryRun) {
    console.log(`[curate] Reindexing (${changed.length} page(s) changed: ${changed.join(", ")})...`);
    await runIndexer();
  } else {
    console.log(`[curate] No reindex needed (${changed.length} changed).`);
  }

  console.log(`[curate] Done. Curated: ${changed.length}. Failed: ${failures.length}.`);

  // Loud failure: if every attempted source failed, exit non-zero so the
  // scheduler surfaces it instead of the index quietly going stale.
  if (failures.length > 0 && changed.length === 0) {
    console.error(`[curate] All curations failed:\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[curate] Fatal:", err);
  process.exit(1);
});
