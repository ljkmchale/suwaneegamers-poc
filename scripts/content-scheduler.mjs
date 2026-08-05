// Repo-owned content scheduler for DB-backed source syncs.
//
// Run manually:
//   node scripts/content-scheduler.mjs --once
//
// Production:
//   apps/web/scripts/start-prod.js starts this beside Next unless
//   SUWANEE_CONTENT_SCHEDULER=0 is set.
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { getDb, pruneExpired } from "./sync-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pollMs = Number(process.env.SUWANEE_SCHEDULER_POLL_MS ?? 60_000);
const once = process.argv.includes("--once");
const runAll = process.argv.includes("--run-all");
const node = process.execPath;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const jobs = [
  {
    id: "lore-page",
    label: "Legends & Lore page",
    schedule: { kind: "daily", time: "10:00" },
    command: [node, ["scripts/sync-lore-page.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/lore"],
  },
  {
    id: "history-page",
    label: "History page",
    schedule: { kind: "daily", time: "10:00" },
    command: [node, ["scripts/sync-history-page.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/history"],
  },
  {
    id: "territories-sync",
    label: "Territories",
    schedule: { kind: "daily", time: "10:00" },
    command: [node, ["scripts/sync-lore.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/territories"],
  },
  {
    id: "lore-core",
    label: "Campaign Setting",
    schedule: { kind: "daily", time: "10:05" },
    command: [node, ["scripts/sync-lore.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/organizations", "/pantheon", "/gazetteer"],
  },
  {
    id: "organization-symbols",
    label: "Organization symbols",
    schedule: { kind: "daily", time: "10:05" },
    command: [node, ["scripts/sync-organization-symbols.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/organizations"],
  },
  {
    id: "pantheon-symbols",
    label: "Pantheon symbols",
    schedule: { kind: "daily", time: "10:10" },
    command: [node, ["scripts/sync-pantheon-symbols.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/pantheon"],
  },
  {
    id: "gazetteer",
    label: "Gazetteer entries",
    schedule: { kind: "daily", time: "10:15" },
    command: [node, ["scripts/sync-gazetteer-entries.mjs"]],
    timeoutMs: 10 * 60_000,
    revalidatePaths: ["/gazetteer"],
  },
  {
    id: "dm-reference",
    label: "DM reference assets",
    schedule: { kind: "daily", time: "10:20" },
    command: [node, ["scripts/sync-dm-reference.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/reference-for-dungeon-masters"],
  },
  {
    id: "crit-tables",
    label: "Crit tables",
    schedule: { kind: "daily", time: "10:25" },
    command: [node, ["scripts/sync-crit-tables.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/crit_tables"],
  },
  {
    id: "campaign-headers",
    label: "Campaign headers",
    schedule: { kind: "daily", time: "10:30" },
    command: [node, ["scripts/sync-campaign-headers.mjs"]],
    timeoutMs: 10 * 60_000,
    revalidatePaths: ["/campaigns", "/previous-campaigns"],
  },
  {
    id: "campaign-roster",
    label: "Campaign character roster",
    schedule: { kind: "daily", time: "10:32" },
    command: [node, ["scripts/sync-campaign-roster.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/campaigns"],
  },
  {
    id: "session-audio",
    label: "Session audio",
    schedule: { kind: "daily", time: "10:40" },
    command: [node, ["scripts/sync-session-audio.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/campaigns", "/calendar"],
  },
  {
    id: "session-notes",
    label: "Session notes",
    schedule: { kind: "daily", time: "10:35" },
    command: [node, [
      path.join("apps", "web", "node_modules", "tsx", "dist", "cli.mjs"),
      "--tsconfig", "apps/web/tsconfig.json",
      "apps/web/scripts/sync-session-notes.ts",
    ]],
    timeoutMs: 15 * 60_000,
    revalidatePaths: ["/campaigns", "/calendar"],
  },
  {
    // Re-splice the saved campaign sessions-card from session_summaries after the
    // session/audio syncs above, so the stored layouts don't drift out of date.
    // Placed after both session jobs in this array; jobs run sequentially in array
    // order within a tick, so this always follows them.
    id: "campaign-session-cards",
    label: "Campaign session cards refresh",
    schedule: { kind: "daily", time: "10:42" },
    command: [node, ["scripts/refresh-campaign-session-cards.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/campaigns", "/previous-campaigns"],
  },
  {
    id: "chronicles-sources",
    label: "Chronicles sources",
    schedule: { kind: "daily", time: "10:45" },
    command: [node, [path.join("apps", "web", "brain-tools", "src", "refresh-sources.mjs")]],
    timeoutMs: 20 * 60_000,
    revalidatePaths: ["/chronicles", "/admin/chronicles"],
  },
  {
    id: "campaign-journeys",
    label: "Campaign journeys",
    schedule: { kind: "daily", time: "10:50" },
    command: [node, ["scripts/sync-campaign-journeys.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: ["/campaign-journeys"],
  },
  {
    id: "site-roadmap",
    label: "Website roadmap (Myra out-of-world)",
    schedule: { kind: "daily", time: "10:51" },
    command: [node, [
      path.join("apps", "web", "node_modules", "tsx", "dist", "cli.mjs"),
      "--tsconfig", "apps/web/tsconfig.json",
      "apps/web/scripts/sync-site-roadmap.ts",
    ]],
    timeoutMs: 3 * 60_000,
    revalidatePaths: [],
  },
  {
    id: "assistant-brain",
    label: "Voice assistant knowledge base",
    schedule: { kind: "daily", time: "10:52" },
    command: [node, ["scripts/build-assistant-brain.mjs"]],
    timeoutMs: 2 * 60_000,
    revalidatePaths: ["/"],
  },
  {
    id: "assistant-autotune",
    label: "Voice assistant auto-tuning",
    schedule: { kind: "daily", time: "11:10" },
    command: [node, [
      path.join("apps", "web", "node_modules", "tsx", "dist", "cli.mjs"),
      "--tsconfig", "apps/web/tsconfig.json",
      "apps/web/scripts/autotune-assistant.ts",
    ]],
    timeoutMs: 3 * 60_000,
    revalidatePaths: ["/"],
  },
  {
    id: "assistant-learn",
    label: "Voice assistant self-learning",
    schedule: { kind: "daily", time: "11:25" },
    command: [node, [
      path.join("apps", "web", "node_modules", "tsx", "dist", "cli.mjs"),
      "--tsconfig", "apps/web/tsconfig.json",
      "apps/web/scripts/learn-assistant.ts",
    ]],
    timeoutMs: 10 * 60_000,
    revalidatePaths: ["/"],
  },
  {
    id: "content-documents",
    label: "JSON content documents",
    schedule: { kind: "daily", time: "10:55" },
    command: [node, ["scripts/sync-content-documents.mjs"]],
    timeoutMs: 5 * 60_000,
    revalidatePaths: [
      "/",
      "/admin/source-managed",
      "/bestiary",
      "/campaigns",
      "/campaign-journeys",
      "/dungeon-masters",
      "/gazetteer",
      "/organizations",
      "/pantheon",
      "/players",
      "/previous-campaigns",
      "/reference-for-dungeon-masters",
      "/territories",
    ],
  },
];

function iso(date = new Date()) {
  return date.toISOString();
}

function tail(value, max = 12_000) {
  if (!value) return "";
  return value.length > max ? value.slice(value.length - max) : value;
}

function scheduleLabel(schedule) {
  if (schedule.kind === "weekly") return `weekly ${schedule.day} ${schedule.time}`;
  return `${schedule.kind} ${schedule.time}`;
}

function commandLabel([cmd, args]) {
  return [cmd, ...args].join(" ");
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_sync_jobs (
      id                TEXT PRIMARY KEY,
      label             TEXT NOT NULL,
      schedule          TEXT NOT NULL,
      command           TEXT NOT NULL,
      enabled           INTEGER NOT NULL DEFAULT 1,
      last_started_at   TEXT,
      last_finished_at  TEXT,
      last_success_at   TEXT,
      last_status       TEXT,
      last_exit_code    INTEGER,
      last_duration_ms  INTEGER,
      next_run_at       TEXT,
      last_message      TEXT
    );

    CREATE TABLE IF NOT EXISTS content_sync_runs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id        TEXT NOT NULL REFERENCES content_sync_jobs(id) ON DELETE CASCADE,
      started_at    TEXT NOT NULL,
      finished_at   TEXT,
      status        TEXT NOT NULL,
      exit_code     INTEGER,
      duration_ms   INTEGER,
      message       TEXT,
      stdout_tail   TEXT,
      stderr_tail   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_content_sync_runs_job_started
      ON content_sync_runs(job_id, started_at DESC);
  `);

  // Add columns for user-editable schedules and custom revalidation jobs (idempotent)
  const cols = new Set(db.pragma(`table_info(content_sync_jobs)`).map((r) => r.name));
  if (!cols.has("schedule_json")) {
    db.exec(`ALTER TABLE content_sync_jobs ADD COLUMN schedule_json TEXT`);
  }
  if (!cols.has("revalidate_paths_json")) {
    db.exec(`ALTER TABLE content_sync_jobs ADD COLUMN revalidate_paths_json TEXT`);
  }
  if (!cols.has("source_job_id")) {
    db.exec(`ALTER TABLE content_sync_jobs ADD COLUMN source_job_id TEXT`);
  }
}

function localScheduledDate(base, time) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0);
}

// Returns the effective schedule for a job, preferring the DB override over the hardcoded default.
function resolveSchedule(job, row) {
  if (row?.schedule_json) {
    try { return JSON.parse(row.schedule_json); } catch { /* fall through */ }
  }
  return job.schedule;
}

function nextRunAfter(schedule, afterDate) {
  if (schedule.kind === "interval") {
    return new Date(afterDate.getTime() + schedule.hours * 60 * 60 * 1000);
  }
  if (schedule.kind === "times") {
    const candidates = schedule.times.map((time) => {
      const next = localScheduledDate(afterDate, time);
      if (next <= afterDate) next.setDate(next.getDate() + 1);
      return next;
    });
    return candidates.reduce((a, b) => (a < b ? a : b));
  }
  // daily / weekly
  let next = localScheduledDate(afterDate, schedule.time);
  if (schedule.kind === "weekly") {
    const wantedDay = schedule.day ?? 1;
    const dayDelta = (wantedDay - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + dayDelta);
  }
  while (next <= afterDate) {
    if (schedule.kind === "weekly") next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
  }
  return next;
}

function nextRunFor(job, row, now = new Date()) {
  const schedule = resolveSchedule(job, row);
  const lastStarted = row?.last_started_at ? new Date(row.last_started_at) : null;

  if (schedule.kind === "interval") {
    return lastStarted ? nextRunAfter(schedule, lastStarted) : now;
  }
  if (schedule.kind === "times") {
    return lastStarted ? nextRunAfter(schedule, lastStarted) : nextRunAfter(schedule, new Date(now.getTime() - 1));
  }

  if (!lastStarted) {
    const today = localScheduledDate(now, schedule.time);
    if (schedule.kind === "weekly") {
      const weekly = nextRunAfter(schedule, new Date(now.getTime() - 1));
      return weekly <= now ? now : weekly;
    }
    return today <= now ? now : today;
  }
  return nextRunAfter(schedule, lastStarted);
}

function upsertJobs(db) {
  const upsert = db.prepare(`
    INSERT INTO content_sync_jobs (id, label, schedule, command, enabled, next_run_at)
    VALUES (@id, @label, @schedule, @command, 1, @nextRunAt)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      schedule = excluded.schedule,
      command = excluded.command,
      next_run_at = COALESCE(content_sync_jobs.next_run_at, excluded.next_run_at)
  `);

  for (const job of jobs) {
    const row = db.prepare(`SELECT * FROM content_sync_jobs WHERE id = ?`).get(job.id);
    upsert.run({
      id: job.id,
      label: job.label,
      schedule: scheduleLabel(job.schedule),
      command: commandLabel(job.command),
      nextRunAt: iso(nextRunFor(job, row)),
    });
  }
}

// Extra margin beyond a job's own timeout before a still-"running" row is
// assumed orphaned. runProcess() SIGTERMs the child at timeoutMs and records the
// result, so a row can only outlive timeoutMs when the scheduler process itself
// died mid-run — leaving a stale "running" status that would otherwise wedge the
// job forever (dueJobs skips running jobs).
const STALE_RUN_GRACE_MS = 2 * 60_000;

function timeoutForRow(row) {
  const hardcoded = jobs.find((j) => j.id === row.id);
  if (hardcoded) return hardcoded.timeoutMs;
  const sourceJob = row.source_job_id ? jobs.find((j) => j.id === row.source_job_id) : null;
  return sourceJob ? sourceJob.timeoutMs : 10_000;
}

// Reset jobs orphaned in "running" by an interrupted scheduler so they can run again.
function reclaimStaleRunning(db, now = new Date()) {
  const running = db.prepare(`SELECT * FROM content_sync_jobs WHERE last_status = 'running'`).all();
  for (const row of running) {
    const startedAt = row.last_started_at ? new Date(row.last_started_at) : null;
    const threshold = timeoutForRow(row) + STALE_RUN_GRACE_MS;
    if (startedAt && now.getTime() - startedAt.getTime() <= threshold) continue;

    const finishedAt = iso(now);
    const message = `Recovered stale run: no completion recorded within ${Math.round(threshold / 1000)}s (scheduler likely interrupted).`;
    db.prepare(
      `UPDATE content_sync_runs
       SET finished_at = ?, status = 'failed', exit_code = -1, message = ?
       WHERE job_id = ? AND status = 'running'`,
    ).run(finishedAt, message, row.id);
    db.prepare(
      `UPDATE content_sync_jobs
       SET last_status = 'failed', last_finished_at = ?, last_exit_code = -1, last_message = ?
       WHERE id = ?`,
    ).run(finishedAt, message, row.id);
    console.warn(`[${finishedAt}] Reclaimed stale running job: ${row.label} (${row.id}).`);
  }
}

function dueJobs(db, now = new Date()) {
  const allRows = db.prepare(`SELECT * FROM content_sync_jobs WHERE enabled = 1`).all();
  const rowsById = new Map(allRows.map((row) => [row.id, row]));
  const hardcodedIds = new Set(jobs.map((j) => j.id));

  // Hardcoded jobs
  const due = jobs.filter((job) => {
    if (runAll) return true;
    const row = rowsById.get(job.id);
    const next = row?.next_run_at ? new Date(row.next_run_at) : nextRunFor(job, row, now);
    return next <= now && row?.last_status !== "running";
  });

  // User-created DB-only jobs — run source job's command if matched, else pure revalidation
  for (const row of allRows) {
    if (hardcodedIds.has(row.id)) continue;
    if (!runAll && row.last_status === "running") continue;
    const schedule = row.schedule_json ? JSON.parse(row.schedule_json) : { kind: "daily", time: "10:00" };
    const next = row.next_run_at ? new Date(row.next_run_at) : nextRunFor({ schedule }, row, now);
    if (runAll || next <= now) {
      const sourceJob = row.source_job_id ? jobs.find((j) => j.id === row.source_job_id) : null;
      due.push({
        id: row.id,
        label: row.label,
        command: sourceJob ? sourceJob.command : null,
        schedule,
        timeoutMs: sourceJob ? sourceJob.timeoutMs : 10_000,
        revalidatePaths: row.revalidate_paths_json ? JSON.parse(row.revalidate_paths_json) : [],
      });
    }
  }

  return due;
}

async function revalidate(paths) {
  const token = process.env.SUWANEE_SCHEDULER_TOKEN;
  if (!token || paths.length === 0) return;

  const base =
    process.env.SUWANEE_SCHEDULER_REVALIDATE_URL ??
    `http://127.0.0.1:${process.env.PORT || "3000"}/api/content-scheduler/revalidate`;

  try {
    const response = await fetch(base, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ paths }),
    });
    if (!response.ok) {
      console.warn(`[${iso()}] Scheduler revalidate failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn(`[${iso()}] Scheduler revalidate failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function runProcess(job) {
  const [cmd, args] = job.command;
  const started = Date.now();
  let stdout = "";
  let stderr = "";
  let timedOut = false;

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env: { ...process.env, SUWANEE_CONTENT_DIR: path.join(root, "content") },
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, job.timeoutMs);

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdout = tail(stdout + text);
      process.stdout.write(`[${job.id}] ${text}`);
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr = tail(stderr + text);
      process.stderr.write(`[${job.id}] ${text}`);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        status: "failed",
        exitCode: -1,
        durationMs: Date.now() - started,
        message: error.message,
        stdout,
        stderr,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const exitCode = timedOut ? -1 : (code ?? 0);
      resolve({
        status: timedOut || exitCode !== 0 ? "failed" : "succeeded",
        exitCode,
        durationMs: Date.now() - started,
        message: timedOut ? `Timed out after ${job.timeoutMs}ms.` : `Exited ${exitCode}.`,
        stdout,
        stderr,
      });
    });
  });
}

async function runJob(db, job) {
  const startedAt = iso();
  const run = db
    .prepare(
      `INSERT INTO content_sync_runs (job_id, started_at, status, message)
       VALUES (?, ?, 'running', 'Started.')`,
    )
    .run(job.id, startedAt);

  db.prepare(
    `UPDATE content_sync_jobs
     SET last_started_at = ?, last_status = 'running', last_message = 'Started.'
     WHERE id = ?`,
  ).run(startedAt, job.id);

  console.log(`[${startedAt}] Content sync starting: ${job.label}`);

  // DB-only revalidation jobs have no subprocess — just bust the cache
  const result = job.command
    ? await runProcess(job)
    : { status: "succeeded", exitCode: 0, durationMs: 1, message: "Cache revalidated.", stdout: "", stderr: "" };
  const finishedAt = iso();
  const jobRow = db.prepare(`SELECT schedule_json FROM content_sync_jobs WHERE id = ?`).get(job.id);
  const schedule = resolveSchedule(job, jobRow);
  const nextRunAt = iso(nextRunAfter(schedule, new Date(startedAt)));

  db.prepare(
    `UPDATE content_sync_runs
     SET finished_at = ?, status = ?, exit_code = ?, duration_ms = ?, message = ?, stdout_tail = ?, stderr_tail = ?
     WHERE id = ?`,
  ).run(
    finishedAt,
    result.status,
    result.exitCode,
    result.durationMs,
    result.message,
    tail(result.stdout),
    tail(result.stderr),
    run.lastInsertRowid,
  );

  db.prepare(
    `UPDATE content_sync_jobs
     SET last_finished_at = ?,
         last_success_at = CASE WHEN ? = 'succeeded' THEN ? ELSE last_success_at END,
         last_status = ?,
         last_exit_code = ?,
         last_duration_ms = ?,
         next_run_at = ?,
         last_message = ?
     WHERE id = ?`,
  ).run(
    finishedAt,
    result.status,
    finishedAt,
    result.status,
    result.exitCode,
    result.durationMs,
    nextRunAt,
    result.message,
    job.id,
  );

  console.log(`[${finishedAt}] Content sync ${result.status}: ${job.label}`);
  if (result.status === "succeeded") await revalidate(job.revalidatePaths);
}

// Run history carries stdout_tail/stderr_tail, so rows are ~1.2KB each and the
// table outweighs everything except analytics within a couple of months. A
// month of history is more than anyone reads back.
const RUN_RETENTION_DAYS = 30;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
let lastRunPruneAt = 0;

function pruneRunHistory(db) {
  const now = Date.now();
  if (now - lastRunPruneAt < PRUNE_INTERVAL_MS) return;
  lastRunPruneAt = now;
  try {
    const deleted = pruneExpired(db, {
      table: "content_sync_runs",
      column: "started_at",
      days: RUN_RETENTION_DAYS,
    });
    if (deleted > 0) {
      console.log(`[${iso()}] Pruned ${deleted} content_sync_runs rows older than ${RUN_RETENTION_DAYS}d.`);
    }
  } catch (error) {
    // Housekeeping must never stop the scheduler from running its jobs.
    console.error(`[${iso()}] Run-history prune failed:`, error);
  }
}

async function tick(db) {
  upsertJobs(db);
  reclaimStaleRunning(db);
  pruneRunHistory(db);
  const pending = dueJobs(db);
  for (const job of pending) {
    await runJob(db, job);
  }
}

const db = getDb();
ensureSchema(db);
upsertJobs(db);

console.log(`[${iso()}] Content scheduler started (${once ? "once" : "daemon"}).`);
await tick(db);

if (!once) {
  setInterval(() => {
    tick(db).catch((error) => {
      console.error(`[${iso()}] Content scheduler tick failed:`, error);
    });
  }, pollMs);
}
