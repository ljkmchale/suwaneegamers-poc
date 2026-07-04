// Fetch the campaign setting Google Doc (markdown) and cache the content for /history.
// The history page reads from this cache; the scheduler runs this daily.
//
// Run manually:  node scripts/sync-history-page.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readContent } from "./content-documents.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_PATH = path.join(root, "content", "history-doc-cache.md");

const DEFAULT_DOC_ID = "1PGWzoocfjPNQ69Q-JsVmNXCFo76a3Z_IkcBuBeDj4yQ";

function getDocId() {
  try {
    const pages = readContent("auto-managed-pages.json");
    const page = pages.find((p) => p.path === "/history");
    const url = page?.sourceUrl ?? "";
    return /\/document\/d\/([\w-]+)/.exec(url)?.[1] ?? DEFAULT_DOC_ID;
  } catch {
    return DEFAULT_DOC_ID;
  }
}

async function main() {
  const docId = getDocId();
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=md`;

  console.log(`Fetching History doc: ${exportUrl}`);
  const res = await fetch(exportUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching doc ${docId}`);

  const markdown = await res.text();
  if (markdown.length < 500) throw new Error(`Response looks too short (${markdown.length} bytes) — aborting`);

  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, markdown, "utf-8");
  console.log(`✓ Saved ${markdown.length} bytes → content/history-doc-cache.md`);
}

main().catch((err) => {
  console.error(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
