import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import { spawn } from "node:child_process";
import { syncGoogleDocSources } from "./google-doc-sync.mjs";
import { processPendingRawSources } from "./process-raw-sources.mjs";

process.env.AUTO_PROCESS_RAW_SOURCES = "false";

console.log("Checking Google Docs sources...");
const syncResult = await syncGoogleDocSources();
console.log(`Checked ${syncResult.checked ?? 0}; pulled ${syncResult.pulled ?? 0}; errors ${syncResult.errors ?? 0}.`);

console.log("Processing unprocessed and stale raw sources...");
const processResult = await processPendingRawSources();
for (const item of processResult.processed) {
  console.log(`Processed ${item.rawFile} -> ${item.page}`);
}
for (const item of processResult.skipped) {
  console.log(`Skipped ${item.rawFile}: ${item.reason}`);
}

if (processResult.processed.length === 0) {
  console.log("No wiki source pages changed; skipping index rebuild.");
} else {
  console.log("Rebuilding index...");
  await runNpmScript("index");
}

function runNpmScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", script], {
      stdio: "inherit",
      shell: true
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm run ${script} exited with code ${code}.`));
    });
  });
}
