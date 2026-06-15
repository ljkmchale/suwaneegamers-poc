import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

interface RefreshScript {
  label: string;
  file: string;
}

export interface ManagedPageRefreshResult {
  path: string;
  scriptsRun: string[];
  message: string;
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

function scriptsForPath(pagePath: string): RefreshScript[] {
  if (pagePath === "/organizations") {
    return [
      { label: "lore content", file: "sync-lore.mjs" },
      { label: "organization symbols", file: "sync-organization-symbols.mjs" },
    ];
  }

  if (pagePath === "/territories") {
    return [{ label: "lore content", file: "sync-lore.mjs" }];
  }

  if (pagePath === "/pantheon") {
    return [{ label: "pantheon symbols", file: "sync-pantheon-symbols.mjs" }];
  }

  if (pagePath === "/gazetteer") {
    return [{ label: "gazetteer entries", file: "sync-gazetteer-entries.mjs" }];
  }

  if (pagePath === "/reference-for-dungeon-masters") {
    return [{ label: "DM reference assets", file: "sync-dm-reference.mjs" }];
  }

  if (pagePath === "/crit_tables") {
    return [{ label: "crit tables", file: "sync-crit-tables.mjs" }];
  }

  if (pagePath === "/campaigns" || pagePath === "/previous-campaigns" || pagePath.startsWith("/campaigns/")) {
    return [{ label: "campaign headers", file: "sync-campaign-headers.mjs" }];
  }

  return [];
}

async function runScript(repoRoot: string, script: RefreshScript) {
  await execFileAsync(process.execPath, [path.join(repoRoot, "scripts", script.file)], {
    cwd: repoRoot,
    maxBuffer: 1024 * 1024 * 5,
    timeout: 1000 * 60 * 5,
    windowsHide: true,
  });
}

export async function refreshManagedPage(pagePath: string): Promise<ManagedPageRefreshResult> {
  const repoRoot = findRepoRoot();
  const scripts = scriptsForPath(pagePath);

  for (const script of scripts) {
    await runScript(repoRoot, script);
  }

  const scriptsRun = scripts.map((script) => script.label);
  const message = scriptsRun.length
    ? `Synced ${scriptsRun.join(", ")} and refreshed the page cache.`
    : "Refreshed the page cache.";

  return {
    path: pagePath,
    scriptsRun,
    message,
  };
}
