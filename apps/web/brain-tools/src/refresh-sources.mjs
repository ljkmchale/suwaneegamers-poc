import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.mjs";
import { syncGoogleDocSources } from "./google-doc-sync.mjs";
import { processPendingRawSources } from "./process-raw-sources.mjs";

process.env.AUTO_PROCESS_RAW_SOURCES = "false";

console.log("Checking Google Docs sources...");
const syncResult = await syncGoogleDocSources();
console.log(`Checked ${syncResult.checked ?? 0}; pulled ${syncResult.pulled ?? 0}; errors ${syncResult.errors ?? 0}.`);

// A single doc failing (a permission change, a moved file) is expected noise. But
// EVERY source failing is systemic — a bad path, a missing key, no network — and
// must not hide behind exit 0, or the index goes stale for months while the job
// reports "succeeded" (that is exactly how it stayed frozen since June). Fail the
// run so content_sync_runs records it and the health surface can catch it.
const checked = syncResult.checked ?? 0;
if (checked > 0 && (syncResult.pulled ?? 0) === 0 && (syncResult.errors ?? 0) >= checked) {
  console.error(`All ${checked} Chronicles sources failed to pull — see errors above. Failing the run.`);
  process.exitCode = 1;
}

console.log("Processing unprocessed and stale raw sources...");
const processResult = await processPendingRawSources();
for (const item of processResult.processed) {
  console.log(`Processed ${item.rawFile} -> ${item.page}`);
}
for (const item of processResult.skipped) {
  console.log(`Skipped ${item.rawFile}: ${item.reason}`);
}

// Rebuild when this run processed a source, OR when the vault holds pages newer
// than the current index. Wiki pages arrive through channels other than the 6
// Google Docs (hand-authored entities, other ingests); keying the rebuild only
// on "did a doc change this run" let 150+ such pages accumulate unindexed for
// months. Comparing the vault's newest page against the index catches all of it.
if (processResult.processed.length > 0) {
  console.log("Rebuilding index (sources changed this run)...");
  await runIndexer();
} else if (indexIsStaleAgainstVault()) {
  console.log("Rebuilding index (vault has pages newer than the index)...");
  await runIndexer();
} else {
  console.log("No source pages changed and the index is current; skipping rebuild.");
}

// True if any wiki .md is newer than the built index (or the index is missing).
function indexIsStaleAgainstVault() {
  let indexMtime = 0;
  try {
    indexMtime = fs.statSync(config.indexPath).mtimeMs;
  } catch {
    return true; // no index yet
  }
  const stack = [path.join(config.vaultRoot, "wiki")];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith(".md") && fs.statSync(full).mtimeMs > indexMtime) return true;
    }
  }
  return false;
}

// Call the indexer by absolute path with the current node binary — the scheduler
// runs this script with cwd = repo root, where `npm run index` would not resolve
// (that script lives in brain-tools/package.json). Deriving the path from this
// module makes the rebuild independent of cwd, npm, and the shell.
function runIndexer() {
  const indexer = fileURLToPath(new URL("./indexer.mjs", import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [indexer], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`indexer exited with code ${code}.`));
    });
  });
}
