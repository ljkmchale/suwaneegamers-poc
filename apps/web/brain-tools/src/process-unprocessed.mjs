import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import { processPendingRawSources } from "./process-raw-sources.mjs";

const args = new Map();
let dryRun = false;
let includeCurrent = false;

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg === "--dry-run") {
    dryRun = true;
  } else if (arg === "--include-current") {
    includeCurrent = true;
  } else if (arg.startsWith("--")) {
    args.set(arg.slice(2), process.argv[index + 1]);
    index += 1;
  }
}

const result = await processPendingRawSources({
  filename: args.get("filename"),
  dryRun,
  includeCurrent
});

if (result.processed.length === 0 && result.skipped.length === 0) {
  console.log("No unprocessed or stale raw sources found.");
}

for (const item of result.processed) {
  const action = dryRun ? "Would process" : "Processed";
  console.log(`${action} ${item.rawFile} -> ${item.page}`);
}

for (const item of result.skipped) {
  console.log(`Skipped ${item.rawFile}: ${item.reason}`);
}
