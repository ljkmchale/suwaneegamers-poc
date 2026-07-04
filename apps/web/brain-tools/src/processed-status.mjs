import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import { getProcessedStatus } from "./processed-sources.mjs";

try {
  const statuses = await getProcessedStatus();
  if (statuses.length === 0) {
    console.log("No raw source files found.");
    process.exit(0);
  }

  for (const item of statuses) {
    const detail = item.processedAt ? ` processed ${item.processedAt}` : " no receipt";
    console.log(`${item.status.padEnd(11)} ${item.rawFile} (${item.ingestStatus};${detail})`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
