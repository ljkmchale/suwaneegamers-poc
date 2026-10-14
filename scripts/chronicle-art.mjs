// Chronicle art queue: drafts a session hero image for each new chapter of the
// five Living Chronicles with Codex (ChatGPT subscription, per-campaign skill),
// then waits for Larry's approval before anything reaches the site.
//
//   node scripts/chronicle-art.mjs scan                       what would be drafted (spends nothing)
//   node scripts/chronicle-art.mjs run [--campaign id] [--chapter n] [--limit n] [--no-settle]
//   node scripts/chronicle-art.mjs list                       drafts waiting for review
//   node scripts/chronicle-art.mjs approve <campaign> <n> [--force]
//   node scripts/chronicle-art.mjs reject  <campaign> <n> [--note "why"]
//   node scripts/chronicle-art.mjs retry   <campaign> <n>     forget a decision so it is redrafted
//
// Scheduled as the user-level task "SuwaneeGamers Chronicle Art" (see
// scripts/chronicle-art.cmd). It is NOT a content-scheduler job: that scheduler
// runs as LocalSystem under NSSM and cannot see the Codex login in ~/.codex.
//
// Gates, in order: the chapter is newer than the latest imaged one, its notes
// are real (length) and settled (unchanged since the last scan), Codex proposes a
// scene whose evidence quotes are verified verbatim against the notes, and no
// character the skill requires a portrait for is missing. Only then is an image
// generated, self-reviewed by Codex against the skill's rules, and parked in
// artwork-drafts/chronicle-queue/ (git-ignored, never served).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  CAMPAIGNS,
  readChapters,
  highestImaged,
  assessNotes,
  verifyBrief,
  slugify,
  asciiFold,
} from "./lib/chronicle-art-notes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE = path.join(root, "artwork-drafts", "chronicle-queue");
const WORK = path.join(QUEUE, ".work");
const LEDGER = path.join(QUEUE, "queue.json");
const LOCK = path.join(QUEUE, ".lock");

const MODEL = process.env.CODEX_ART_MODEL?.trim() || "gpt-5.5";
const SETTLE_HOURS = Number(process.env.CHRONICLE_ART_SETTLE_HOURS ?? 12);
const DEFAULT_LIMIT = Number(process.env.CHRONICLE_ART_LIMIT ?? 2);
const MAX_WAITING = Number(process.env.CHRONICLE_ART_MAX_WAITING ?? 6);
const MAX_ATTEMPTS = 2;
const CODEX_HOME = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex");

class LimitError extends Error {}

const stamp = () => new Date().toISOString();
const log = (message) => console.log(`[${stamp()}] ${message}`);

// --- ledger ------------------------------------------------------------------
function loadLedger() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER, "utf8"));
  } catch {
    return { seen: {}, items: {} };
  }
}

function saveLedger(ledger) {
  fs.mkdirSync(QUEUE, { recursive: true });
  const tmp = `${LEDGER}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2));
  fs.renameSync(tmp, LEDGER);
}

function withLock(fn) {
  fs.mkdirSync(QUEUE, { recursive: true });
  try {
    const age = Date.now() - fs.statSync(LOCK).mtimeMs;
    if (age > 90 * 60_000) fs.rmSync(LOCK, { force: true });
  } catch {
    // no lock
  }
  let fd;
  try {
    fd = fs.openSync(LOCK, "wx");
  } catch {
    throw new Error("another chronicle-art run is in progress (artwork-drafts/chronicle-queue/.lock)");
  }
  fs.writeSync(fd, String(process.pid));
  fs.closeSync(fd);
  try {
    return fn();
  } finally {
    fs.rmSync(LOCK, { force: true });
  }
}

const itemKey = (campaign, key) => `${campaign.id}/${key}`;
const itemDir = (campaign, key) => path.join(QUEUE, campaign.id, `session-${key}`);

// --- skills ------------------------------------------------------------------
const skillDir = (campaign) => path.join(CODEX_HOME, "skills", campaign.skill);

/** Changes when portraits/rules change, so a "blocked" chapter is retried only then. */
function skillFingerprint(campaign) {
  const hash = crypto.createHash("sha256");
  for (const sub of ["assets", "references"]) {
    const dir = path.join(skillDir(campaign), sub);
    let names = [];
    try {
      names = fs.readdirSync(dir).sort();
    } catch {
      // missing
    }
    for (const name of names) {
      const stat = fs.statSync(path.join(dir, name));
      hash.update(`${sub}/${name}:${stat.size}:${Math.floor(stat.mtimeMs)}\n`);
    }
  }
  return hash.digest("hex").slice(0, 16);
}

function usablePortrait(campaign, name) {
  if (!name || /candidate|superseded|^\.|[\\/]/.test(name)) return null;
  const file = path.join(skillDir(campaign), "assets", name);
  return fs.existsSync(file) ? file : null;
}

// --- codex -------------------------------------------------------------------
function codexBin() {
  const fromEnv = process.env.CODEX_ART_BIN?.trim();
  if (fromEnv) return fromEnv;
  const app = path.join(process.env.LOCALAPPDATA ?? "", "OpenAI", "Codex", "bin", "codex.exe");
  return fs.existsSync(app) ? app : "codex";
}

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decline", "moment", "action", "location", "evidence", "participants", "heldObjects",
    "conditions", "relativeHeights", "missingPortraits", "titleSlug"],
  properties: {
    decline: { type: ["string", "null"] },
    moment: { type: "string" },
    action: { type: "string" },
    location: { type: "string" },
    evidence: { type: "array", items: { type: "string" } },
    participants: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "species", "doing", "referencePortrait"],
        properties: {
          name: { type: "string" },
          species: { type: "string" },
          doing: { type: "string" },
          referencePortrait: { type: ["string", "null"] },
        },
      },
    },
    heldObjects: { type: "array", items: { type: "string" } },
    conditions: { type: "string" },
    relativeHeights: { type: "string" },
    missingPortraits: { type: "array", items: { type: "string" } },
    titleSlug: { type: "string" },
  },
};

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["passed", "summary", "failures", "regenerated"],
  properties: {
    passed: { type: "boolean" },
    summary: { type: "string" },
    failures: { type: "array", items: { type: "string" } },
    regenerated: { type: "boolean" },
  },
};

function runCodex({ prompt, schema, images = [], timeoutMs, tag }) {
  fs.mkdirSync(WORK, { recursive: true });
  const schemaFile = path.join(WORK, `${tag}.schema.json`);
  const outFile = path.join(WORK, `${tag}.out.json`);
  fs.writeFileSync(schemaFile, JSON.stringify(schema));
  fs.rmSync(outFile, { force: true });
  const args = [
    "exec", "-m", MODEL,
    // The elevated Windows sandbox from the user's config cannot start from a
    // scheduled task; the unelevated one still confines the run read-only.
    "-c", 'windows.sandbox="unelevated"',
    "--sandbox", "read-only",
    "--skip-git-repo-check",
    "-C", root,
    "--output-schema", schemaFile,
    "-o", outFile,
    ...images.flatMap((image) => ["-i", image]),
  ];
  const started = Date.now();
  const result = spawnSync(codexBin(), args, {
    input: prompt,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CODEX_HOME },
    windowsHide: true,
  });
  const transcript = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (/usage limit|rate.?limit|quota|too many requests|429/i.test(transcript) && !fs.existsSync(outFile)) {
    throw new LimitError("Codex reports the ChatGPT plan limit is reached");
  }
  if (result.error || result.status !== 0 || !fs.existsSync(outFile)) {
    const detail = result.error?.message ?? transcript.split("\n").filter((l) => /error/i.test(l)).slice(-3).join(" | ");
    throw new Error(`codex exec failed (${result.status ?? "no exit"}): ${detail || "no output"}`.slice(0, 600));
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(outFile, "utf8"));
  } catch {
    throw new Error("codex returned a message that is not valid JSON");
  }
  const sessionId = /session id:\s*([0-9a-f-]{20,})/i.exec(transcript)?.[1] ?? null;
  return { parsed, sessionId, started };
}

function findGeneratedImage(sessionId, startedMs) {
  const base = path.join(CODEX_HOME, "generated_images");
  const candidates = [];
  const dirs = sessionId ? [path.join(base, sessionId)] : [];
  for (const dir of dirs) {
    try {
      for (const name of fs.readdirSync(dir)) candidates.push(path.join(dir, name));
    } catch {
      // not created
    }
  }
  const images = candidates
    .filter((file) => /\.(png|webp|jpe?g)$/i.test(file))
    .map((file) => ({ file, mtime: fs.statSync(file).mtimeMs }))
    .filter((entry) => entry.mtime >= startedMs - 5000)
    .sort((a, b) => b.mtime - a.mtime);
  return images[0]?.file ?? null;
}

// --- prompts -----------------------------------------------------------------
function briefPrompt(campaign, chapter, chapterFile) {
  return [
    `Use the ${campaign.skill} skill. This is step 1 of 2 for ${campaign.name}, session ${chapter.number}: choose the scene only. Do NOT generate any image and do NOT edit any file.`,
    ``,
    `The complete notes for this one session are in ${path.relative(root, chapterFile)} (an exact extract of the canonical player notes). Read it completely, and read the skill's references/character-and-review-rules.md completely, before answering.`,
    ``,
    `Select ONE visually strong moment that is explicitly documented in those notes, exactly as the skill's workflow step 1 requires. Rules:`,
    `- evidence: at least two quotes copied VERBATIM from the notes (each at least 8 words, exact wording) that establish the moment, who acts, and the held objects. Do not paraphrase.`,
    `- participants: a closed list of only the characters in the frame, each with species, what they are doing, and referencePortrait set to the exact file name from the skill's assets/ folder (or null when none exists). Never use files marked candidate or superseded.`,
    `- missingPortraits: ONLY characters for whom the skill's rules require an approved portrait reference that does not exist in assets/. Use [] when the skill allows drawing the character from the notes' described appearance.`,
    `- Equipment and appearance must follow the timeline in the skill's rules for THIS session, not later sessions.`,
    `- decline: null normally. If the notes contain no scene that is explicitly documented well enough to draw faithfully, set decline to a one-sentence reason and leave the other fields empty.`,
    `- titleSlug: 3-6 lowercase words naming the moment.`,
    ``,
    `Reply with JSON only, matching the provided schema.`,
  ].join("\n");
}

function imagePrompt(campaign, chapter, brief) {
  return [
    `Use the ${campaign.skill} skill. This is step 2 of 2 for ${campaign.name}, session ${chapter.number} (${chapter.title}). The scene has been chosen and verified against the notes; do not choose a different one.`,
    ``,
    `Generate exactly ONE image with the built-in image_gen tool, 16:9 landscape, painterly fantasy illustration in the established style of this campaign's chronicle art. No text, captions, logos or watermarks. Do NOT edit any repository file.`,
    ``,
    `Scene brief (JSON):`,
    JSON.stringify({ moment: brief.moment, action: brief.action, location: brief.location,
      participants: brief.participants, heldObjects: brief.heldObjects, conditions: brief.conditions,
      relativeHeights: brief.relativeHeights }, null, 2),
    ``,
    `The attached images are the approved portraits for the characters who have one; use each only for that character's face, coloration and stable physical design. State identities, species and relative heights explicitly in the image prompt. Keep the cast exactly the participants listed.`,
    ``,
    `After generating, inspect the actual bitmap against EVERY review gate in the skill's references/character-and-review-rules.md (documented moment, closed cast, recognisable identities, species and scale, action owner, session-correct equipment and conditions, no invented props, anatomy, no text). If it fails any gate, regenerate once with a focused correction and inspect again. Reply with JSON only: passed, a one-sentence summary, failures (gate names that still fail, [] if passed) and regenerated.`,
  ].join("\n");
}

// --- core steps --------------------------------------------------------------
function draftChapter(campaign, chapter, ledger) {
  const key = itemKey(campaign, chapter.key);
  const dir = itemDir(campaign, chapter.key);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(WORK, { recursive: true });
  const prior = ledger.items[key] ?? {};
  const attempts = (prior.attempts ?? 0) + 1;
  const base = { hash: chapter.hash, title: chapter.title, attempts, updated: stamp() };

  const chapterFile = path.join(WORK, `${campaign.id}-${chapter.key}.txt`);
  // ASCII-folded: Codex's Windows shell turns curly quotes into "ƒ?o", which
  // would make its verbatim evidence quotes unverifiable.
  fs.writeFileSync(
    chapterFile,
    asciiFold(`${campaign.name} - session ${chapter.number}: ${chapter.title}\n\n${chapter.body}\n`),
  );

  // Step 1: choose and verify the scene.
  log(`${key}: choosing a scene from ${chapter.words} words of notes`);
  const step1 = runCodex({
    prompt: briefPrompt(campaign, chapter, chapterFile),
    schema: BRIEF_SCHEMA,
    timeoutMs: 12 * 60_000,
    tag: `${campaign.id}-${chapter.key}-brief`,
  });
  const brief = step1.parsed;
  fs.writeFileSync(path.join(dir, "brief.json"), JSON.stringify(brief, null, 2));

  if (brief.decline) {
    return { ...base, status: "declined", reason: brief.decline };
  }
  const problems = verifyBrief(brief, chapter.body);
  if (problems.length) {
    return { ...base, status: "declined", reason: `scene not verifiable from the notes: ${problems.join("; ")}` };
  }
  if (brief.missingPortraits.length) {
    return {
      ...base,
      status: "blocked",
      reason: `needs approved portrait(s) first: ${brief.missingPortraits.join(", ")}`,
      skillFingerprint: skillFingerprint(campaign),
    };
  }
  const portraits = [];
  for (const person of brief.participants) {
    if (!person.referencePortrait) continue;
    const file = usablePortrait(campaign, person.referencePortrait);
    if (!file) {
      return { ...base, status: "declined", reason: `brief named an unusable portrait file "${person.referencePortrait}"` };
    }
    if (!portraits.includes(file)) portraits.push(file);
  }

  // Step 2: generate and self-review.
  log(`${key}: generating "${brief.moment.slice(0, 70)}" with ${portraits.length} portrait(s)`);
  const step2 = runCodex({
    prompt: imagePrompt(campaign, chapter, brief),
    schema: REVIEW_SCHEMA,
    images: portraits,
    timeoutMs: 20 * 60_000,
    tag: `${campaign.id}-${chapter.key}-image`,
  });
  const generated = findGeneratedImage(step2.sessionId, step2.started);
  if (!generated) throw new Error("Codex finished but no generated image was found");
  const draft = path.join(dir, `draft-${Date.now()}.png`);
  fs.copyFileSync(generated, draft);
  fs.writeFileSync(path.join(dir, "review.json"), JSON.stringify(step2.parsed, null, 2));

  return {
    ...base,
    status: "drafted",
    draft: path.relative(root, draft).replaceAll("\\", "/"),
    slug: slugify(brief.titleSlug, `session-${chapter.key}`),
    moment: brief.moment,
    selfReview: step2.parsed,
    attempts,
  };
}

function eligible(campaign, chapter, ledger, { settle, explicit }) {
  const key = itemKey(campaign, chapter.key);
  const notes = assessNotes(chapter);
  if (!notes.real) return { ok: false, why: `notes not ready: ${notes.reason}` };
  const item = ledger.items[key];
  if (item) {
    if (["drafted", "approved", "rejected"].includes(item.status)) return { ok: false, why: item.status };
    if (item.status === "declined" && item.hash === chapter.hash && !explicit) {
      return { ok: false, why: `declined: ${item.reason}` };
    }
    if (item.status === "blocked" && item.skillFingerprint === skillFingerprint(campaign) && !explicit) {
      return { ok: false, why: item.reason };
    }
    if (item.status === "failed" && (item.attempts ?? 0) >= MAX_ATTEMPTS && item.hash === chapter.hash && !explicit) {
      return { ok: false, why: `failed ${item.attempts}x: ${item.reason}` };
    }
  }
  if (settle && !explicit) {
    const seen = ledger.seen[key];
    const ageHours = seen?.hash === chapter.hash ? (Date.now() - Date.parse(seen.since)) / 3_600_000 : 0;
    if (ageHours < SETTLE_HOURS) {
      return { ok: false, why: `notes still settling (unchanged ${ageHours.toFixed(1)}h of ${SETTLE_HOURS}h)` };
    }
  }
  return { ok: true, why: notes.reason };
}

function candidates(ledger, opts) {
  const out = [];
  for (const campaign of CAMPAIGNS) {
    if (opts.campaign && campaign.id !== opts.campaign) continue;
    let chapters;
    try {
      chapters = readChapters(root, campaign);
    } catch (error) {
      out.push({ campaign, error: `cannot read notes: ${error.message}` });
      continue;
    }
    const imaged = highestImaged(root, campaign);
    for (const chapter of chapters) {
      if (opts.chapter ? chapter.number !== opts.chapter : chapter.number <= imaged) continue;
      // Record when this exact text was first seen so it can settle.
      const key = itemKey(campaign, chapter.key);
      if (ledger.seen[key]?.hash !== chapter.hash) ledger.seen[key] = { hash: chapter.hash, since: stamp() };
      out.push({ campaign, chapter, ...eligible(campaign, chapter, ledger, { settle: opts.settle, explicit: Boolean(opts.chapter) }) });
    }
  }
  return out;
}

function waitingCount(ledger) {
  return Object.values(ledger.items).filter((item) => item.status === "drafted").length;
}

// --- review page --------------------------------------------------------------
function writeReviewPage(ledger) {
  const escape = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const waiting = Object.entries(ledger.items).filter(([, item]) => item.status === "drafted");
  const cards = waiting.map(([key, item]) => {
    const [campaignId, chapterKey] = key.split("/");
    const flag = item.selfReview?.passed === false
      ? `<p class="warn">Codex self-review FAILED: ${escape(item.selfReview.failures.join(", "))}</p>`
      : `<p class="ok">Codex self-review passed${item.selfReview?.regenerated ? " (after one regeneration)" : ""}.</p>`;
    return `<section><h2>${escape(campaignId)} - session ${escape(chapterKey)}: ${escape(item.title)}</h2>
<img src="../../${escape(item.draft)}" alt="">
<p><b>Scene:</b> ${escape(item.moment)}</p>${flag}
<p><code>node scripts/chronicle-art.mjs approve ${escape(campaignId)} ${Number(chapterKey)}</code><br>
<code>node scripts/chronicle-art.mjs reject ${escape(campaignId)} ${Number(chapterKey)} --note "why"</code></p></section>`;
  });
  const html = `<!doctype html><meta charset="utf-8"><title>Chronicle art drafts</title>
<style>body{font:15px system-ui;background:#14110f;color:#eee;max-width:1100px;margin:2rem auto;padding:0 1rem}
section{border:1px solid #4a3f35;border-radius:8px;padding:1rem;margin:1.5rem 0}img{width:100%;border-radius:6px}
code{background:#000;padding:.15rem .4rem;border-radius:4px}.warn{color:#ffb4a8}.ok{color:#b6e3a3}</style>
<h1>Chronicle art drafts awaiting approval (${waiting.length})</h1>${cards.join("\n") || "<p>Nothing waiting.</p>"}`;
  fs.writeFileSync(path.join(QUEUE, "review.html"), html);
}

// --- commands ----------------------------------------------------------------
function parseArgs(argv) {
  const opts = { settle: true, force: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--campaign") opts.campaign = argv[++i];
    else if (arg === "--chapter") opts.chapter = Number(argv[++i]);
    else if (arg === "--limit") opts.limit = Number(argv[++i]);
    else if (arg === "--note") opts.note = argv[++i];
    else if (arg === "--no-settle") opts.settle = false;
    else if (arg === "--force") opts.force = true;
    else rest.push(arg);
  }
  return { opts, rest };
}

function cmdScan(opts) {
  const ledger = loadLedger();
  const found = candidates(ledger, opts);
  saveLedger(ledger);
  if (!found.length) console.log("No chapters newer than the latest imaged session.");
  for (const row of found) {
    if (row.error) console.log(`${row.campaign.id}: ${row.error}`);
    else console.log(`${row.campaign.id} session ${row.chapter.number} (${row.chapter.title}): ${row.ok ? "READY to draft - " : "skipped - "}${row.why}`);
  }
  console.log(`Waiting for your approval: ${waitingCount(ledger)}`);
}

function cmdRun(opts) {
  withLock(() => {
    const ledger = loadLedger();
    const limit = opts.limit ?? DEFAULT_LIMIT;
    if (waitingCount(ledger) >= MAX_WAITING && !opts.chapter) {
      log(`${waitingCount(ledger)} drafts are already waiting for review; not drafting more.`);
      writeReviewPage(ledger);
      return;
    }
    const ready = candidates(ledger, opts).filter((row) => row.ok);
    saveLedger(ledger);
    if (!ready.length) log("Nothing ready to draft.");
    let done = 0;
    for (const row of ready) {
      if (done >= limit) break;
      const key = itemKey(row.campaign, row.chapter.key);
      try {
        ledger.items[key] = draftChapter(row.campaign, row.chapter, ledger);
        log(`${key}: ${ledger.items[key].status}${ledger.items[key].reason ? ` - ${ledger.items[key].reason}` : ""}`);
      } catch (error) {
        if (error instanceof LimitError) {
          log(`${key}: ${error.message}; stopping until the next run.`);
          saveLedger(ledger);
          break;
        }
        const prior = ledger.items[key] ?? {};
        ledger.items[key] = {
          status: "failed", hash: row.chapter.hash, title: row.chapter.title,
          attempts: (prior.attempts ?? 0) + 1, reason: error.message, updated: stamp(),
        };
        log(`${key}: failed - ${error.message}`);
      }
      done += 1;
      saveLedger(ledger);
    }
    writeReviewPage(ledger);
    log(`Drafted ${done}; ${waitingCount(ledger)} waiting. Review: artwork-drafts/chronicle-queue/review.html`);
  });
}

function cmdList() {
  const ledger = loadLedger();
  for (const [key, item] of Object.entries(ledger.items)) {
    console.log(`${key}\t${item.status}\t${item.title ?? ""}\t${item.reason ?? item.moment ?? ""}`);
  }
}

function findItem(ledger, campaignId, number) {
  const campaign = CAMPAIGNS.find((c) => c.id === campaignId);
  if (!campaign) throw new Error(`unknown campaign "${campaignId}" (${CAMPAIGNS.map((c) => c.id).join(", ")})`);
  const key = itemKey(campaign, String(number).padStart(2, "0"));
  return { campaign, key, item: ledger.items[key] };
}

async function cmdApprove(campaignId, number, opts) {
  const { default: sharp } = await import("sharp");
  sharp.cache(false);
  await withLock(async () => {
    const ledger = loadLedger();
    const { campaign, key, item } = findItem(ledger, campaignId, number);
    if (!item || item.status !== "drafted") throw new Error(`${key} is not a draft awaiting approval`);
    const chapterKey = key.split("/")[1];
    const chapter = readChapters(root, campaign).find((c) => c.key === chapterKey);
    if (!chapter) throw new Error(`${key}: chapter no longer exists in the notes`);
    const brief = JSON.parse(fs.readFileSync(path.join(itemDir(campaign, chapterKey), "brief.json"), "utf8"));
    if (chapter.hash !== item.hash && !opts.force) {
      const problems = verifyBrief(brief, chapter.body);
      if (problems.length) throw new Error(`notes changed since drafting and the scene no longer verifies (${problems[0]}). Use retry, or --force.`);
    }

    const imagesDir = path.join(root, "apps", "web", "media", "images", "chronicles", campaign.id);
    fs.mkdirSync(imagesDir, { recursive: true });
    let version = 1;
    let name;
    do {
      name = `session-${chapterKey}-${item.slug}-v${version++}.webp`;
    } while (fs.existsSync(path.join(imagesDir, name)));
    await sharp(path.join(root, item.draft))
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(imagesDir, name));

    const mapFile = path.join(root, campaign.dir, "session-images.json");
    const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
    const url = `/media/images/chronicles/${campaign.id}/${name}`;
    map[chapterKey] = url;
    fs.writeFileSync(mapFile, `${JSON.stringify(map, null, 2)}\n`);

    const build = spawnSync(process.execPath, [path.join(root, campaign.dir, "build-chronicle.mjs")], { cwd: root, encoding: "utf8" });
    if (build.status !== 0) throw new Error(`chronicle build failed: ${build.stderr || build.stdout}`);
    const served = path.join(root, "content", "chronicles", campaign.served);
    fs.copyFileSync(path.join(root, campaign.dir, campaign.output), served);
    if (!fs.readFileSync(served, "utf8").includes(url)) throw new Error(`published chronicle does not reference ${url}`);

    ledger.items[key] = { ...item, status: "approved", published: url, approved: stamp() };
    saveLedger(ledger);
    writeReviewPage(ledger);
    const audit = spawnSync(process.execPath, [path.join(root, "scripts", "audit-local-images.mjs")], { cwd: root, encoding: "utf8" });
    console.log(`Published ${url}\nChronicle: /campaigns/${campaign.id}/chronicle (content/chronicles/${campaign.served})`);
    console.log(audit.status === 0 ? "Image audit passed." : `Image audit FAILED:\n${audit.stdout}${audit.stderr}`);
  });
}

function cmdReject(campaignId, number, opts) {
  withLock(() => {
    const ledger = loadLedger();
    const { key, item } = findItem(ledger, campaignId, number);
    if (!item) throw new Error(`${key} is not in the queue`);
    ledger.items[key] = { ...item, status: "rejected", note: opts.note ?? "", rejected: stamp() };
    saveLedger(ledger);
    writeReviewPage(ledger);
    console.log(`${key} rejected. Use "retry ${campaignId} ${number}" to draft it again.`);
  });
}

function cmdRetry(campaignId, number) {
  withLock(() => {
    const ledger = loadLedger();
    const { key } = findItem(ledger, campaignId, number);
    delete ledger.items[key];
    saveLedger(ledger);
    writeReviewPage(ledger);
    console.log(`${key} cleared; it will be drafted on the next run.`);
  });
}

const [command, ...argv] = process.argv.slice(2);
const { opts, rest } = parseArgs(argv);
try {
  if (command === "scan") cmdScan(opts);
  else if (command === "run") cmdRun(opts);
  else if (command === "list") cmdList();
  else if (command === "approve") await cmdApprove(rest[0], Number(rest[1]), opts);
  else if (command === "reject") cmdReject(rest[0], Number(rest[1]), opts);
  else if (command === "retry") cmdRetry(rest[0], Number(rest[1]));
  else {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 11).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    process.exitCode = command ? 1 : 0;
  }
} catch (error) {
  console.error(`[${stamp()}] ${error.message}`);
  process.exitCode = 1;
}
