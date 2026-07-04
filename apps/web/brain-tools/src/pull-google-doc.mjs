import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import { pullGoogleDocToRaw } from "./google-docs.mjs";

const args = parseArgs(process.argv.slice(2));

if (!args.url) {
  console.error("Usage: npm run pull-doc -- --url <google-doc-url> [--title <title>] [--filename <name.md>] [--overwrite]");
  process.exit(1);
}

try {
  const result = await pullGoogleDocToRaw({
    url: args.url,
    title: args.title,
    filename: args.filename,
    overwrite: args.overwrite
  });
  console.log(`Pulled "${result.title}" to ${result.relativePath}`);
  console.log(`Characters: ${result.characterCount}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = { overwrite: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--overwrite") {
      parsed.overwrite = true;
      continue;
    }
    if (arg === "--url" || arg === "--title" || arg === "--filename") {
      parsed[arg.slice(2)] = argv[index + 1] ?? "";
      index += 1;
    }
  }
  return parsed;
}
