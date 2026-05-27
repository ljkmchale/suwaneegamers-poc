import fs from "fs";
import path from "path";
import { PAGE_SECTIONS } from "./pageSections";
import type { PageItem } from "./pageBlocks";

type RawLayouts = Record<string, unknown[]>;

function layoutPath() {
  return path.join(process.cwd(), "../../content/page-layouts.json");
}

function readRaw(): RawLayouts {
  try {
    return JSON.parse(fs.readFileSync(layoutPath(), "utf-8")) as RawLayouts;
  } catch {
    return {};
  }
}

/** Returns the stored section + block order for a page. */
export function getPageLayout(pageId: string): PageItem[] {
  const raw = readRaw();
  const stored = raw[pageId];

  if (!stored?.length) {
    // Default: all sections in declared order, no blocks
    return (PAGE_SECTIONS[pageId] ?? []).map((s) => ({
      kind: "section" as const,
      id: s.id,
    }));
  }

  // Migrate old format (plain string array) transparently
  if (typeof stored[0] === "string") {
    return (stored as string[]).map((id) => ({ kind: "section" as const, id }));
  }

  return stored as PageItem[];
}

export function setPageLayout(pageId: string, items: PageItem[]): void {
  const all = readRaw();
  all[pageId] = items as unknown[];
  fs.writeFileSync(layoutPath(), JSON.stringify(all, null, 2) + "\n", "utf-8");
}
