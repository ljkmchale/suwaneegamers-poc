import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { JOB_PATHS } from "@/lib/contentScheduler";

const execFileAsync = promisify(execFile);

interface RefreshScript {
  label: string;
  /** Path relative to repo root */
  file: string;
  /** Matching content_sync_jobs.id — used to update job status and insert run records */
  jobId: string;
  /** Use npx tsx instead of node (required for TypeScript scripts) */
  tsx?: boolean;
}

export interface ManagedPageRefreshResult {
  path: string;
  scriptsRun: string[];
  message: string;
}

const ALL_SCRIPTS: RefreshScript[] = [
  { label: "Legends & Lore page", file: "scripts/sync-lore-page.mjs", jobId: "lore-page" },
  { label: "History page", file: "scripts/sync-history-page.mjs", jobId: "history-page" },
  { label: "lore content", file: "scripts/sync-lore.mjs", jobId: "lore-core" },
  { label: "organization symbols", file: "scripts/sync-organization-symbols.mjs", jobId: "organization-symbols" },
  { label: "pantheon symbols", file: "scripts/sync-pantheon-symbols.mjs", jobId: "pantheon-symbols" },
  { label: "gazetteer entries", file: "scripts/sync-gazetteer-entries.mjs", jobId: "gazetteer" },
  { label: "DM reference assets", file: "scripts/sync-dm-reference.mjs", jobId: "dm-reference" },
  { label: "crit tables", file: "scripts/sync-crit-tables.mjs", jobId: "crit-tables" },
  { label: "campaign headers", file: "scripts/sync-campaign-headers.mjs", jobId: "campaign-headers" },
  { label: "session notes", file: "apps/web/scripts/sync-session-notes.ts", jobId: "session-notes", tsx: true },
  { label: "session audio", file: "scripts/sync-session-audio.mjs", jobId: "session-audio" },
  { label: "Chronicles sources", file: "apps/web/brain-tools/src/refresh-sources.mjs", jobId: "chronicles-sources" },
  { label: "content documents", file: "scripts/sync-content-documents.mjs", jobId: "content-documents" },
];

function scriptsForPath(pagePath: string): RefreshScript[] {
  if (pagePath === "/organizations") {
    return [
      { label: "lore content", file: "scripts/sync-lore.mjs", jobId: "lore-core" },
      { label: "organization symbols", file: "scripts/sync-organization-symbols.mjs", jobId: "organization-symbols" },
    ];
  }
  if (pagePath === "/territories") {
    return [{ label: "lore content", file: "scripts/sync-lore.mjs", jobId: "territories-sync" }];
  }
  if (pagePath === "/pantheon") {
    return [{ label: "pantheon symbols", file: "scripts/sync-pantheon-symbols.mjs", jobId: "pantheon-symbols" }];
  }
  if (pagePath === "/gazetteer") {
    return [{ label: "gazetteer entries", file: "scripts/sync-gazetteer-entries.mjs", jobId: "gazetteer" }];
  }
  if (pagePath === "/reference-for-dungeon-masters") {
    return [{ label: "DM reference assets", file: "scripts/sync-dm-reference.mjs", jobId: "dm-reference" }];
  }
  if (pagePath === "/crit_tables") {
    return [{ label: "crit tables", file: "scripts/sync-crit-tables.mjs", jobId: "crit-tables" }];
  }
  if (pagePath === "/calendar") {
    return [
      { label: "session notes", file: "apps/web/scripts/sync-session-notes.ts", jobId: "session-notes", tsx: true },
      { label: "session audio", file: "scripts/sync-session-audio.mjs", jobId: "session-audio" },
    ];
  }
  if (
    pagePath === "/campaigns" ||
    pagePath === "/previous-campaigns" ||
    pagePath.startsWith("/campaigns/")
  ) {
    return [
      { label: "campaign headers", file: "scripts/sync-campaign-headers.mjs", jobId: "campaign-headers" },
      { label: "session notes", file: "apps/web/scripts/sync-session-notes.ts", jobId: "session-notes", tsx: true },
      { label: "session audio", file: "scripts/sync-session-audio.mjs", jobId: "session-audio" },
    ];
  }
  if (pagePath === "/advents_of_harmony") {
    return [
      { label: "Chronicles sources", file: "apps/web/brain-tools/src/refresh-sources.mjs", jobId: "chronicles-sources" },
    ];
  }
  return [];
}

function findRepoRoot() {
  let current = process.cwd();
  for (let depth = 0; depth < 5; depth += 1) {
    const packagePath = path.join(current, "package.json");
    if (fs.existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8")) as { name?: string };
        if (pkg.name === "suwaneegamers-poc") return current;
      } catch {
        // Keep walking.
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(process.cwd(), "..", "..");
}

function tail(s: string, max = 12_000) {
  return s.length > max ? s.slice(s.length - max) : s;
}

async function runScript(repoRoot: string, script: RefreshScript): Promise<void> {
  const db = getDb();
  const startedAt = new Date().toISOString();

  db.prepare(
    `UPDATE content_sync_jobs SET last_status = 'running', last_started_at = ? WHERE id = ?`,
  ).run(startedAt, script.jobId);

  // Invoke tsx via Node.js directly (no shell) to avoid spaces-in-path issues on Windows.
  // tsx's CLI module lives in the web app's node_modules since that's where it's installed.
  const tsxCli = path.join(
    repoRoot,
    "apps", "web", "node_modules", "tsx", "dist", "cli.mjs",
  );

  const start = Date.now();
  let status: "succeeded" | "failed" = "succeeded";
  let exitCode = 0;
  let stdout = "";
  let stderr = "";
  let errorMessage: string | null = null;
  let thrownError: unknown;

  try {
    const result = script.tsx
      ? await execFileAsync(process.execPath, [tsxCli, "--tsconfig", "apps/web/tsconfig.json", script.file], {
          cwd: repoRoot,
          shell: false,
          maxBuffer: 1024 * 1024 * 5,
          timeout: 1000 * 60 * 15,
          windowsHide: true,
        })
      : await execFileAsync(process.execPath, [script.file], {
          cwd: repoRoot,
          shell: false,
          maxBuffer: 1024 * 1024 * 5,
          timeout: 1000 * 60 * 5,
          windowsHide: true,
        });
    stdout = result.stdout ?? "";
    stderr = result.stderr ?? "";
  } catch (err) {
    status = "failed";
    thrownError = err;
    exitCode = (err as NodeJS.ErrnoException & { code?: number }).code ?? 1;
    stdout = (err as { stdout?: string }).stdout ?? "";
    stderr = (err as { stderr?: string }).stderr ?? "";
    errorMessage = err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
  } finally {
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - start;

    if (status === "succeeded") {
      db.prepare(
        `UPDATE content_sync_jobs
         SET last_status = 'succeeded', last_finished_at = ?, last_success_at = ?,
             last_duration_ms = ?, last_exit_code = 0, last_message = NULL
         WHERE id = ?`,
      ).run(finishedAt, finishedAt, durationMs, script.jobId);
    } else {
      db.prepare(
        `UPDATE content_sync_jobs
         SET last_status = 'failed', last_finished_at = ?,
             last_duration_ms = ?, last_exit_code = ?, last_message = ?
         WHERE id = ?`,
      ).run(finishedAt, durationMs, exitCode, errorMessage, script.jobId);
    }

    db.prepare(
      `INSERT INTO content_sync_runs
         (job_id, started_at, finished_at, status, exit_code, duration_ms, message, stdout_tail, stderr_tail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      script.jobId,
      startedAt,
      finishedAt,
      status,
      exitCode,
      durationMs,
      errorMessage,
      tail(stdout) || null,
      tail(stderr) || null,
    );
  }

  if (thrownError) throw thrownError;

  if (status === "succeeded") {
    for (const p of JOB_PATHS[script.jobId] ?? []) {
      revalidatePath(p, "layout");
    }
  }
}

export async function refreshManagedPage(pagePath: string): Promise<ManagedPageRefreshResult> {
  const repoRoot = findRepoRoot();
  const scripts = scriptsForPath(pagePath);

  for (const script of scripts) {
    await runScript(repoRoot, script);
  }

  const scriptsRun = scripts.map((s) => s.label);
  const message = scriptsRun.length
    ? `Synced ${scriptsRun.join(", ")} and refreshed the page cache.`
    : "Refreshed the page cache.";

  return { path: pagePath, scriptsRun, message };
}

export async function refreshJobById(jobId: string): Promise<ManagedPageRefreshResult> {
  const script = ALL_SCRIPTS.find((s) => s.jobId === jobId);

  // Revalidate-only jobs (no sync script) — just bust the page cache.
  if (!script) {
    const paths = JOB_PATHS[jobId];
    if (!paths || paths.length === 0) throw new Error(`No script registered for job "${jobId}"`);
    for (const p of paths) revalidatePath(p, "layout");
    return { path: jobId, scriptsRun: [], message: "Refreshed the page cache." };
  }

  const repoRoot = findRepoRoot();
  await runScript(repoRoot, script);
  return {
    path: jobId,
    scriptsRun: [script.label],
    message: `Synced ${script.label}.`,
  };
}

export async function refreshAllContent(): Promise<ManagedPageRefreshResult> {
  const repoRoot = findRepoRoot();
  for (const script of ALL_SCRIPTS) {
    await runScript(repoRoot, script);
  }
  const scriptsRun = ALL_SCRIPTS.map((s) => s.label);
  return {
    path: "*",
    scriptsRun,
    message: `Synced all content: ${scriptsRun.join(", ")}.`,
  };
}
