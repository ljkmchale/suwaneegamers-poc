// Regenerates the AUTO block of Myra's self-model — the admin "Systems detail"
// section of content/assistant-self-knowledge.md — from her real, live state, so
// she keeps an accurate description of how she works without anyone hand-editing
// it. This is the self-model counterpart to scripts/build-assistant-brain.mjs.
//
// Derived automatically:
//   - Nightly jobs & schedules   -> content_sync_jobs (the scheduler's own table)
//   - Personas & voices          -> content/assistant-personas.json
//   - Current self-tuning        -> content/assistant-tuning.json
//   - App version & commit       -> package.json + git
// Human-known (rarely changes)   -> content/assistant-systems.json (models, service)
//
// Run manually:  pnpm content:build-assistant-self-model
// Also runs daily via scripts/content-scheduler.mjs (job id "assistant-self-model").
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { getDb } from "./sync-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = process.env.SUWANEE_CONTENT_DIR ?? path.join(root, "content");
const docPath = path.join(contentRoot, "assistant-self-knowledge.md");

const AUTO_BEGIN =
  "<!-- AUTO:BEGIN — regenerated nightly by scripts/build-assistant-self-model.mjs; edits inside this block are overwritten -->";
const AUTO_END = "<!-- AUTO:END -->";

function readJsonIfPresent(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(contentRoot, name), "utf-8"));
  } catch {
    return fallback;
  }
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

function appVersion() {
  const pkg = readJsonIfPresent(path.join("..", "apps", "web", "package.json"), null)
    ?? readJsonIfPresent(path.join("..", "package.json"), null);
  return pkg?.version ?? "unknown";
}

function enabledJobs() {
  try {
    return getDb()
      .prepare(
        `SELECT label, schedule, last_status FROM content_sync_jobs
         WHERE enabled = 1 ORDER BY label`,
      )
      .all();
  } catch {
    return [];
  }
}

function buildAutoBlock() {
  const systems = readJsonIfPresent("assistant-systems.json", {});
  const personas = readJsonIfPresent("assistant-personas.json", { personas: [] });
  const tuning = readJsonIfPresent("assistant-tuning.json", {});
  const jobs = enabledJobs();

  const personaList = Array.isArray(personas?.personas) ? personas.personas : [];
  const voiceCount = new Set(
    personaList.map((p) => p?.voice).filter(Boolean),
  ).size;

  const commit = gitCommit();
  const version = appVersion();
  const failing = jobs.filter((j) => j.last_status === "failed").length;

  const lines = [];
  lines.push("## Systems detail (admin)");
  lines.push("");
  lines.push(
    `- App: version ${version}${commit ? ` (commit ${commit})` : ""}. ${systems.webService ?? "Next.js web app."}`,
  );
  if (systems.stt || systems.llm || systems.tts) {
    lines.push("- Models:");
    if (systems.stt) lines.push(`  - Speech-to-text: ${systems.stt}`);
    if (systems.llm) lines.push(`  - Language model: ${systems.llm}`);
    if (systems.tts) lines.push(`  - Text-to-speech: ${systems.tts}`);
  }
  if (systems.voiceStack) {
    lines.push(`- Voice stack: ${systems.voiceStack}.`);
  }
  lines.push(
    `- I offer ${personaList.length} persona${personaList.length === 1 ? "" : "s"}`
      + ` across ${voiceCount} voice${voiceCount === 1 ? "" : "s"}.`,
  );

  if (jobs.length > 0) {
    lines.push(
      `- Nightly jobs: ${jobs.length} enabled${failing > 0 ? `, ${failing} currently failing` : ", all green on last run"}. They re-sync content and retune me, then rebuild my brain and self-model:`,
    );
    for (const job of jobs) {
      lines.push(`  - ${job.label} (${job.schedule})`);
    }
  }

  if (Object.keys(tuning).length > 0) {
    const t = tuning;
    const parts = [];
    if (t.minEndpointingDelay != null && t.maxEndpointingDelay != null) {
      parts.push(`${t.minEndpointingDelay}-${t.maxEndpointingDelay}s wait before replying`);
    }
    if (t.minInterruptionWords != null) {
      parts.push(`interrupts after ${t.minInterruptionWords} words`);
    }
    if (parts.length > 0) {
      lines.push(`- Current self-tuning (auto-tuned nightly): ${parts.join("; ")}.`);
    }
  }

  return lines.join("\n").trim();
}

function render(existing, autoBlock) {
  const stamped = `${AUTO_BEGIN}\n<!-- last generated ${new Date().toISOString()} -->\n\n${autoBlock}\n${AUTO_END}`;
  if (existing.includes(AUTO_BEGIN) && existing.includes(AUTO_END)) {
    const before = existing.slice(0, existing.indexOf(AUTO_BEGIN));
    const after = existing.slice(existing.indexOf(AUTO_END) + AUTO_END.length);
    return `${before}${stamped}${after}`;
  }
  // No markers yet: append the block at the end.
  return `${existing.trim()}\n\n${stamped}\n`;
}

const existing = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf-8") : "";
const output = render(existing, buildAutoBlock());
fs.writeFileSync(docPath, output, "utf-8");

console.log(
  `[${new Date().toISOString()}] Built assistant self-model: ${path.relative(root, docPath)} (${output.length} chars).`,
);
