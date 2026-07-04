import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../src/config.mjs";
import { getProcessedStatus } from "../src/processed-sources.mjs";

const statuses = await getProcessedStatus();
const stale = statuses.filter((item) => item.status === "stale");
const unprocessed = statuses.filter((item) => item.status === "unprocessed");
const feedback = await readJsonl(path.join(config.dataDir, "answer-feedback.jsonl"));

console.log("Campaign Brain readiness report");
console.log("");
console.log(`Raw sources: ${statuses.length}`);
console.log(`Unprocessed: ${unprocessed.length}`);
console.log(`Stale: ${stale.length}`);
console.log(`Flagged answer feedback: ${feedback.length}`);

printList("Unprocessed raw sources", unprocessed.map((item) => item.rawFile));
printList("Stale raw sources", stale.map((item) => item.rawFile));
printList("Recent flagged answers", feedback.slice(-10).reverse().map((item) => `${item.ts} - ${item.question}`));

console.log("");
console.log("Suggested pre-session commands:");
console.log("- npm run processed-status");
console.log("- npm run audit-wiki");
console.log("- npm run test:brain");
console.log("- npm run eval:answers");

async function readJsonl(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function printList(title, values) {
  console.log("");
  console.log(`${title}: ${values.length}`);
  for (const value of values.slice(0, 20)) console.log(`- ${value}`);
  if (values.length > 20) console.log(`- ... ${values.length - 20} more`);
}
