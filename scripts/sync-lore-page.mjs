// Fetch the Legends & Lore Google Doc and cache the HTML to content/.
// The lore page reads from this cache; the scheduler runs this daily.
//
// Run manually:  node scripts/sync-lore-page.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readContent } from "./content-documents.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_PATH = path.join(root, "content", "lore-doc-cache.html");

const DEFAULT_DOC_ID = "1cB30vxRCQXjrUt-JV4z8alDVZWvHtqFkYIwhoGlXYJ0";

function getDocId() {
  try {
    const pages = readContent("auto-managed-pages.json");
    const page = pages.find((p) => p.path === "/lore");
    const url = page?.sourceUrl ?? "";
    return /\/document\/d\/([\w-]+)/.exec(url)?.[1] ?? DEFAULT_DOC_ID;
  } catch {
    return DEFAULT_DOC_ID;
  }
}

async function main() {
  const docId = getDocId();
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`;

  console.log(`Fetching Legends & Lore doc: ${exportUrl}`);
  const res = await fetch(exportUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching doc ${docId}`);

  const html = await res.text();
  if (html.length < 1000) throw new Error(`Response looks too short (${html.length} bytes) — aborting`);

  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, html, "utf-8");
  console.log(`✓ Saved ${html.length} bytes → content/lore-doc-cache.html`);
}

main().catch((err) => {
  console.error(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
