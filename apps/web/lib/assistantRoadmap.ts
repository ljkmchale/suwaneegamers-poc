import { readContent } from "@/lib/contentFiles";

// Myra's SITE ROADMAP compartment — a separate, out-of-world channel of
// knowledge distinct from the in-world Myrdae lore in her brain and Chronicles.
//
// The group keeps a "Site: Action Items" Google Doc of website enhancements
// (checkbox items per page) plus a "Site: Ideas" wishlist. This module parses
// that doc into structured records, stores them as content/site-roadmap.json,
// and formats a compact block the LiveKit token route ships to the agent so
// Myra can answer "is X planned?", "what are people asking for?", and "has Y
// been built yet?" — always framed as real-world facts about the website's
// development, never as game-world lore.

export interface RoadmapActionItem {
  /** The page/area heading the item lived under, e.g. "Campaigns Page". */
  section: string;
  /** The item text (markdown stripped, whitespace normalized). */
  text: string;
  /** True when the checkbox was ticked ([x]) — i.e. already built. */
  done: boolean;
}

export interface SiteRoadmap {
  /** Canonical Google Doc URL the roadmap was synced from. */
  source: string;
  /** ISO timestamp of the last successful sync. */
  syncedAt: string;
  /** Per-page enhancement checklist items (both open and completed). */
  actionItems: RoadmapActionItem[];
  /** The free-form "Ideas" wishlist. */
  ideas: string[];
}

const EMPTY_ROADMAP: SiteRoadmap = {
  source: "",
  syncedAt: "",
  actionItems: [],
  ideas: [],
};

// How many items to surface to the agent, so the roadmap block stays small in
// dispatch metadata (the brain must stay compact — it rides every session).
const MAX_OPEN = 24;
const MAX_DONE = 12;
const MAX_IDEAS = 16;

/** Strip markdown emphasis/escapes and normalize quotes and whitespace. */
function cleanText(raw: string): string {
  return raw
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/!\[\]\[[^\]]*\]/g, "") // stray image refs
    .replace(/\\([-*_[\]()#.])/g, "$1") // markdown backslash escapes
    .replace(/\*\*/g, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse the exported markdown of the "Site" planning doc into structured
 * roadmap records. Pure and side-effect-free so it can be unit tested and
 * reused by the sync script.
 *
 * Recognized regions (single-`#` headings):
 *   - "# Action Items"  -> per-page "## <Page>" subsections of "- [ ]/[x]" items
 *   - "# Ideas"         -> numbered or bulleted wishlist entries
 * Every other single-`#` region (e.g. "# Site: …", "# Documents: Action Items",
 * "# Synchronization", architecture notes) is intentionally ignored: those are
 * internal mechanics, not group-facing site ideas.
 */
export function parseRoadmapDoc(markdown: string): {
  actionItems: RoadmapActionItem[];
  ideas: string[];
} {
  const lines = markdown.split(/\r?\n/);
  const actionItems: RoadmapActionItem[] = [];
  const ideas: string[] = [];

  let region: "action" | "ideas" | null = null;
  let currentSection = "General";

  for (const line of lines) {
    // Single-`#` heading (not `##`) switches regions.
    const h1 = /^#\s+(?!#)(.*)$/.exec(line);
    if (h1) {
      const title = cleanText(h1[1]);
      if (/^action items$/i.test(title)) {
        region = "action";
        currentSection = "General";
      } else if (/^ideas$/i.test(title)) {
        region = "ideas";
      } else {
        // "Site: …", "Documents: Action Items", "Synchronization", etc.
        region = null;
      }
      continue;
    }

    if (region === "action") {
      const h2 = /^##\s+(.*)$/.exec(line);
      if (h2) {
        currentSection = cleanText(h2[1]) || "General";
        continue;
      }
      const checkbox = /^[-*]\s*\[\s*([xX ])\s*\]\s*(.*)$/.exec(line.trim());
      if (checkbox) {
        const text = cleanText(checkbox[2]);
        if (text) {
          actionItems.push({
            section: currentSection,
            text,
            done: checkbox[1].toLowerCase() === "x",
          });
        }
      }
      continue;
    }

    if (region === "ideas") {
      const bullet = /^\s*(?:\d+\.|[-*•])\s+(.*)$/.exec(line);
      if (bullet) {
        const text = cleanText(bullet[1]);
        // Skip empty bullets and table rows that leaked past the region check.
        if (text && !text.startsWith("|")) ideas.push(text);
      }
    }
  }

  return { actionItems, ideas };
}

/** Read the stored roadmap (DB-first, JSON fallback). Never throws. */
export function getSiteRoadmap(): SiteRoadmap {
  try {
    const data = readContent<Partial<SiteRoadmap>>("site-roadmap.json");
    return {
      source: String(data.source ?? ""),
      syncedAt: String(data.syncedAt ?? ""),
      actionItems: Array.isArray(data.actionItems)
        ? data.actionItems
            .filter((item): item is RoadmapActionItem =>
              Boolean(item) && typeof item.text === "string")
            .map((item) => ({
              section: String(item.section ?? "General"),
              text: String(item.text),
              done: Boolean(item.done),
            }))
        : [],
      ideas: Array.isArray(data.ideas)
        ? data.ideas.filter((idea): idea is string => typeof idea === "string" && idea.trim().length > 0)
        : [],
    };
  } catch {
    return EMPTY_ROADMAP;
  }
}

/**
 * Format the roadmap as a compact, explicitly out-of-world text block for the
 * agent prompt. Returns "" when there is nothing to say, so the token route can
 * omit the field entirely.
 */
export function formatRoadmapForAgent(roadmap: SiteRoadmap): string {
  const open = roadmap.actionItems.filter((item) => !item.done);
  const done = roadmap.actionItems.filter((item) => item.done);
  if (open.length === 0 && done.length === 0 && roadmap.ideas.length === 0) {
    return "";
  }

  const lines: string[] = [
    "The following is real-world information about the Suwanee Gamers WEBSITE and",
    "its ongoing development — the group's running list of site enhancements and",
    "ideas. This is NOT part of the Myrdae game world, campaign lore, or Chronicles.",
    "Answer roadmap questions plainly as the website's assistant, and never mix",
    "these items into in-world lore answers.",
  ];

  if (open.length > 0) {
    lines.push("", "Requested / open site enhancements (not yet built):");
    for (const item of open.slice(0, MAX_OPEN)) {
      lines.push(`- [${item.section}] ${item.text}`);
    }
  }
  if (done.length > 0) {
    lines.push("", "Site enhancements already completed (built):");
    for (const item of done.slice(0, MAX_DONE)) {
      lines.push(`- [${item.section}] ${item.text}`);
    }
  }
  if (roadmap.ideas.length > 0) {
    lines.push("", "Ideas under consideration (not yet committed):");
    for (const idea of roadmap.ideas.slice(0, MAX_IDEAS)) {
      lines.push(`- ${idea}`);
    }
  }

  return lines.join("\n");
}

/** Convenience: the formatted roadmap block for dispatch metadata. */
export function getAssistantRoadmap(): string {
  return formatRoadmapForAgent(getSiteRoadmap());
}
