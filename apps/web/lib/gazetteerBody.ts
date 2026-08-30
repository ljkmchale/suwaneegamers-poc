import "server-only";
import fs from "node:fs";
import path from "node:path";
import { contentDir } from "@/lib/contentFiles";

// Gazetteer detail bodies are the settlement docs' Markdown, fetched and cleaned
// (base64 images stripped) by scripts/sync-gazetteer-bodies.mjs and written to
// content/gazetteer-bodies/<slug>.md. The gazetteer grid page is intentionally
// left untouched; these bodies are only read by the /gazetteer/[slug] detail
// route (and are safe to serve - visibility is players-level lore).

function bodyPath(slug: string): string {
  const safe = path.basename(slug); // guard against traversal
  return path.join(contentDir(), "gazetteer-bodies", `${safe}.md`);
}

/** The current Markdown body for a gazetteer settlement, or null if none exists. */
export function getGazetteerBodyMarkdown(slug: string): string | null {
  try {
    const text = fs.readFileSync(bodyPath(slug), "utf8");
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}
