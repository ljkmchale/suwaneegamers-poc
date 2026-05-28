import fs from "fs";
import path from "path";
import { PAGE_SECTIONS } from "./pageSections";
import type { PageItem, PageGridMeta } from "./pageBlocks";

type RawEntry = unknown[] | { grid?: PageGridMeta; items: unknown[] };
type RawLayouts = Record<string, RawEntry>;

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

function extractItems(entry: RawEntry): unknown[] {
  return Array.isArray(entry) ? entry : entry.items;
}

/** Returns the stored section + block order for a page. */
export function getPageLayout(pageId: string): PageItem[] {
  const raw = readRaw();
  const stored = raw[pageId];

  if (!stored) {
    return (PAGE_SECTIONS[pageId] ?? []).map((s) => ({
      kind: "section" as const,
      id: s.id,
    }));
  }

  const items = extractItems(stored);

  if (!items.length) {
    return (PAGE_SECTIONS[pageId] ?? []).map((s) => ({
      kind: "section" as const,
      id: s.id,
    }));
  }

  // Migrate old format (plain string array) transparently
  if (typeof items[0] === "string") {
    return (items as string[]).map((id) => ({ kind: "section" as const, id }));
  }

  return items as PageItem[];
}

/** Returns the page-level grid config, or null if none is set. */
export function getPageGrid(pageId: string): PageGridMeta | null {
  const stored = readRaw()[pageId];
  if (!stored || Array.isArray(stored)) return null;
  return (stored as { grid?: PageGridMeta }).grid ?? null;
}

/**
 * Saves the page layout.
 * - grid === undefined  → preserve any existing grid setting
 * - grid === null       → clear the grid (store as plain array)
 * - grid has a value    → set/update the grid
 */
export function setPageLayout(pageId: string, items: PageItem[], grid?: PageGridMeta | null): void {
  const all = readRaw();
  const existing = all[pageId];
  const existingGrid =
    existing && !Array.isArray(existing)
      ? (existing as { grid?: PageGridMeta }).grid
      : undefined;

  const newGrid = grid === undefined ? existingGrid : (grid ?? undefined);

  all[pageId] = newGrid
    ? { grid: newGrid, items: items as unknown[] }
    : (items as unknown[]);

  fs.writeFileSync(layoutPath(), JSON.stringify(all, null, 2) + "\n", "utf-8");
}
