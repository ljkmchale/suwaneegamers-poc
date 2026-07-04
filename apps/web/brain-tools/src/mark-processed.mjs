import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import { markRawSourceProcessed } from "./processed-sources.mjs";

const args = parseArgs(process.argv.slice(2));

if (!args.filename) {
  console.error("Usage: npm run mark-processed -- --filename <raw-file.md> [--status processed|partial|needs-review] [--pages <path,path>] [--notes <text>]");
  process.exit(1);
}

try {
  const receipt = await markRawSourceProcessed({
    filename: args.filename,
    status: args.status,
    pages: args.pages ? args.pages.split(",") : [],
    notes: args.notes
  });
  console.log(`Marked ${receipt.rawFile} as ${receipt.status}`);
  console.log(`Hash: ${receipt.rawContentHash}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--filename" || arg === "--status" || arg === "--pages" || arg === "--notes") {
      parsed[arg.slice(2)] = argv[index + 1] ?? "";
      index += 1;
    }
  }
  return parsed;
}
