import { readContent } from "@/lib/contentFiles";

// Myra's "WHAT'S NEW" compartment — a curated, dated changelog of shipped
// improvements, distinct from every other channel of knowledge she carries.
//
// This is deliberately NOT the in-world Myrdae lore (the brain / Chronicles),
// NOT the file-freshness snapshot (websiteUpdates, which only knows raw file
// timestamps), and NOT the roadmap (which is the requested/built/ideated
// planning list from a Google Doc). Those tell Myra a file changed or a feature
// is planned; none of them let her answer "what's new?" or "when were you last
// updated?" in plain, human terms.
//
// Entries are hand-curated in content/assistant-updates.json — one line per
// shipped feature, covering both site features (e.g. location ratings) and
// Myra's own capabilities (e.g. weather, personas). The LiveKit token route
// ships a compact formatted block to the agent so Myra can report recent
// changes when asked, always framed as real-world facts about the website.

export type UpdateArea = "site" | "myra";

export interface SiteUpdate {
  /** ISO calendar date the change shipped, e.g. "2026-08-18". */
  date: string;
  /** "site" = a website feature; "myra" = one of Myra's own capabilities. */
  area: UpdateArea;
  /** Short headline for the change. */
  title: string;
  /** One-sentence, visitor-facing description. */
  detail: string;
}

// Keep the block small — it rides in dispatch metadata every session. Only the
// most recent changes are worth surfacing when someone asks "what's new?".
const MAX_UPDATES = 15;

function isUpdateArea(value: unknown): value is UpdateArea {
  return value === "site" || value === "myra";
}

/** Read the curated changelog (DB-first, JSON fallback). Never throws. */
export function getSiteUpdates(): SiteUpdate[] {
  try {
    const data = readContent<{ updates?: unknown }>("assistant-updates.json");
    const raw = Array.isArray(data?.updates) ? data.updates : [];
    return raw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        date: String(item.date ?? "").trim(),
        area: isUpdateArea(item.area) ? item.area : "site",
        title: String(item.title ?? "").trim(),
        detail: String(item.detail ?? "").trim(),
      }))
      .filter((item) => item.date && item.title)
      // Newest first, so "what's new" leads with the latest change.
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  } catch {
    return [];
  }
}

/**
 * Format the changelog as a compact, explicitly out-of-world text block for the
 * agent prompt. Returns "" when there is nothing to say, so the token route can
 * omit the field entirely.
 */
export function formatUpdatesForAgent(updates: SiteUpdate[]): string {
  if (updates.length === 0) return "";

  const latest = updates[0];
  const lines: string[] = [
    "The following is real-world information about recent CHANGES to the Suwanee",
    "Gamers website and to Myra herself — a curated changelog of what has shipped.",
    "This is NOT part of the Myrdae game world, campaign lore, or Chronicles. Use",
    "it ONLY to answer questions about what is new, what changed recently, or when",
    "the site or Myra was last updated. Do not volunteer it unprompted, and never",
    "mix these items into in-world lore answers.",
    "",
    `Most recent change shipped: ${latest.date}.`,
    "",
    "Recent updates (newest first; [site] = website feature, [Myra] = assistant capability):",
  ];
  for (const update of updates.slice(0, MAX_UPDATES)) {
    const tag = update.area === "myra" ? "Myra" : "site";
    lines.push(`- ${update.date} [${tag}] ${update.title}: ${update.detail}`);
  }

  return lines.join("\n");
}

/** Convenience: the formatted changelog block for dispatch metadata. */
export function getAssistantUpdates(): string {
  return formatUpdatesForAgent(getSiteUpdates());
}
