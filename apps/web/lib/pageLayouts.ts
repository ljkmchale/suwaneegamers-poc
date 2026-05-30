import fs from "fs";
import path from "path";
import { PAGE_SECTIONS } from "./pageSections";
import type { PageItem, PageGridMeta, CanvasMeta } from "./pageBlocks";

type RawMeta = { grid?: PageGridMeta; canvas?: CanvasMeta; items: unknown[] };
type RawEntry = unknown[] | RawMeta;
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

function extractMeta(entry: RawEntry): RawMeta | null {
  return Array.isArray(entry) ? null : entry;
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
  return extractMeta(stored)?.grid ?? null;
}

/** Returns the page-level canvas config, or null if none is set. */
export function getPageCanvas(pageId: string): CanvasMeta | null {
  const stored = readRaw()[pageId];
  if (!stored || Array.isArray(stored)) return null;
  return extractMeta(stored)?.canvas ?? null;
}

/**
 * Saves the page layout.
 * - grid/canvas === undefined  → preserve any existing setting
 * - grid/canvas === null       → clear that setting
 * - grid/canvas has a value    → set/update that setting
 * Canvas and grid are mutually exclusive; providing one clears the other.
 */
export function setPageLayout(
  pageId: string,
  items: PageItem[],
  grid?: PageGridMeta | null,
  canvas?: CanvasMeta | null,
): void {
  const all = readRaw();
  const existing = all[pageId];
  const meta = extractMeta(existing ?? []);

  const newGrid   = grid   === undefined ? meta?.grid   : (grid   ?? undefined);
  const newCanvas = canvas === undefined ? meta?.canvas : (canvas ?? undefined);

  // Canvas and grid are mutually exclusive
  if (newCanvas) {
    all[pageId] = { canvas: newCanvas, items: items as unknown[] };
  } else if (newGrid) {
    all[pageId] = { grid: newGrid, items: items as unknown[] };
  } else {
    all[pageId] = items as unknown[];
  }

  fs.writeFileSync(layoutPath(), JSON.stringify(all, null, 2) + "\n", "utf-8");
}
