import fs from "fs";
import path from "path";
import { contentDir } from "./contentFiles";
import { PAGE_SECTIONS } from "./pageSections";
import { buildCampaignDetailLayout, findCampaignForDetailPath } from "./campaignDetailLayouts";
import type { PageItem, PageGridMeta, CanvasMeta } from "./pageBlocks";

type RawMeta = { grid?: PageGridMeta; canvas?: CanvasMeta; items: unknown[] };
type RawEntry = unknown[] | RawMeta;
type RawLayouts = Record<string, RawEntry>;

function legacyLayoutPath() {
  return path.join(/*turbopackIgnore: true*/ contentDir(), "page-layouts.json");
}

function layoutsDir() {
  return path.join(/*turbopackIgnore: true*/ contentDir(), "page-layouts");
}

function pageIdToLayoutPath(pageId: string) {
  const safeId = pageId.startsWith("/") ? pageId : `/${pageId}`;
  if (safeId === "/") return path.join(/*turbopackIgnore: true*/ layoutsDir(), "home.json");

  const segments = safeId
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "-"))
    .filter((segment) => segment !== "." && segment !== "..");

  if (!segments.length) return path.join(/*turbopackIgnore: true*/ layoutsDir(), "home.json");

  const fileName = `${segments.pop()}.json`;
  return path.join(/*turbopackIgnore: true*/ layoutsDir(), ...segments, fileName);
}

function readLegacyRaw(): RawLayouts {
  try {
    return JSON.parse(fs.readFileSync(legacyLayoutPath(), "utf-8")) as RawLayouts;
  } catch {
    return {};
  }
}

function readRawEntry(pageId: string): RawEntry | undefined {
  try {
    return JSON.parse(fs.readFileSync(pageIdToLayoutPath(pageId), "utf-8")) as RawEntry;
  } catch {
    return readLegacyRaw()[pageId];
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
  const stored = readRawEntry(pageId);
  const campaign = findCampaignForDetailPath(pageId);

  if (!stored) {
    if (campaign) return buildCampaignDetailLayout(campaign);
    return (PAGE_SECTIONS[pageId] ?? []).map((s) => ({
      kind: "section" as const,
      id: s.id,
    }));
  }

  const items = extractItems(stored);

  if (!items.length) {
    if (campaign) return buildCampaignDetailLayout(campaign);
    return (PAGE_SECTIONS[pageId] ?? []).map((s) => ({
      kind: "section" as const,
      id: s.id,
    }));
  }

  // Migrate old format (plain string array) transparently.
  if (typeof items[0] === "string") {
    return (items as string[]).map((id) => ({ kind: "section" as const, id }));
  }

  return items as PageItem[];
}

/** Returns the page-level grid config, or null if none is set. */
export function getPageGrid(pageId: string): PageGridMeta | null {
  const stored = readRawEntry(pageId);
  if (!stored || Array.isArray(stored)) return null;
  return extractMeta(stored)?.grid ?? null;
}

/** Returns the page-level canvas config, or null if none is set. */
export function getPageCanvas(pageId: string): CanvasMeta | null {
  const stored = readRawEntry(pageId);
  if (!stored || Array.isArray(stored)) return null;
  return extractMeta(stored)?.canvas ?? null;
}
