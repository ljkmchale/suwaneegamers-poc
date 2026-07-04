import fs from "fs";
import { contentPath, readContent } from "@/lib/contentFiles";
import { getAutoManagedPages, getEffectiveDocExportUrl, googleDocExportUrl } from "@/lib/autoManagedPagesData";
import type { BlockItem } from "@/lib/pageBlocks";

export interface PantheonDeity {
  id: string;
  name: string;
  title: string | null;
  domain: string | null;
  image: string | null;
  href: string | null;
  details: string | null;
}

const FALLBACK_SOURCE_URL =
  "https://docs.google.com/document/d/1PGWzoocfjPNQ69Q-JsVmNXCFo76a3Z_IkcBuBeDj4yQ";

// Pantheon and History are sections of the same Campaign Setting document.
// The daily source jobs keep this local export current so public page loads do
// not have to wait for Google before they can render.
const PANTHEON_CACHE_PATH = contentPath("history-doc-cache.md");

export const PANTHEON_REVALIDATE_SECONDS = 24 * 60 * 60;

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CANONICAL_DEITY_NAMES = new Map<string, string>([
  ["divera", "Diverra"],
  ["diverra", "Diverra"],
  ["divvera", "Diverra"],
]);

function canonicalDeityName(value: string): string {
  const name = value.trim();
  return CANONICAL_DEITY_NAMES.get(slug(name)) ?? name;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\\-/g, "-")
    .replace(/\*\*\[([^\]]+)\]\([^)]+\)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function cleanMarkdownDetails(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\{#[^}]+\}/g, "")
    .replace(/####\s+\*\*([^*]+)\*\*/g, "#### $1")
    .replace(/\\-/g, "-")
    .trim();
}

function readLocalPantheonCards(): PantheonDeity[] {
  try {
    const layout = readContent<BlockItem[]>("page-layouts/pantheon.json");
    return layout
      .filter((item): item is BlockItem => item.kind === "block" && item.type === "deity-card")
      .map((item) => {
        const title = String(item.props.title ?? "Deity");
        const [name, divineTitle] = title.split(/\s+[—-]\s+/, 2);
        const quotedTitle = divineTitle?.replace(/^["“]|["”]$/g, "").trim() || null;
        return {
          id: item.id,
          name: name.trim(),
          title: quotedTitle,
          domain: (item.props.domain as string | undefined) ?? null,
          image: (item.props.image as string | undefined) ?? null,
          href: (item.props.href as string | undefined) ?? null,
          details: null,
        };
      });
  } catch {
    return [];
  }
}

function localCardMap(): Map<string, PantheonDeity> {
  return new Map(readLocalPantheonCards().map((deity) => [slug(deity.name), deity]));
}

export function getPantheonSourceUrl(): string {
  const entry = getAutoManagedPages().find((page) => page.path === "/pantheon");
  return entry?.sourceUrl || FALLBACK_SOURCE_URL;
}

export function getPantheonExportUrl(): string {
  return getEffectiveDocExportUrl("/pantheon", "md") ?? googleDocExportUrl(FALLBACK_SOURCE_URL, "md")!;
}

function extractNewOrderTable(markdown: string): PantheonDeity[] {
  const tableStart = markdown.indexOf("| Name | Title | Domain(s) |");
  if (tableStart < 0) return [];
  const afterTable = markdown.slice(tableStart).split("\n");
  const rows: PantheonDeity[] = [];

  for (const line of afterTable.slice(2)) {
    if (!line.startsWith("|")) break;
    const cells = line.split("|").slice(1, -1).map((cell) => stripMarkdown(cell));
    if (cells.length < 3 || !cells[0]) continue;
    const name = canonicalDeityName(cells[0]);
    rows.push({
      id: `pan-${slug(name)}`,
      name,
      title: cells[1] || null,
      domain: cells[2] || null,
      image: null,
      href: null,
      details: null,
    });
  }

  return rows;
}

function extractDetailSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  const tableStart = markdown.indexOf("| Name | Title | Domain(s) |");
  if (tableStart < 0) return sections;

  const afterTable = markdown.slice(tableStart);
  const detailOffset = afterTable.search(/^###\s+/m);
  if (detailOffset < 0) return sections;

  const detailStart = tableStart + detailOffset;
  const nextChapterStart = markdown.slice(detailStart).search(/^chapter\s+\d+|^#\s+\*\*(?:Factions|Organizations)/im);
  const detailEnd = nextChapterStart >= 0 ? detailStart + nextChapterStart : undefined;
  const detailMarkdown = markdown.slice(detailStart, detailEnd);
  const headingRegex = /^###\s+(.+?)\s*(?:\{#[^}]+\})?\s*$/gm;
  const headings: Array<{ name: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(detailMarkdown))) {
    const heading = stripMarkdown(match[1]);
    const name = canonicalDeityName(heading.split(",")[0]);
    headings.push({ name, start: match.index, end: headingRegex.lastIndex });
  }

  headings.forEach((heading, index) => {
    const next = headings[index + 1]?.start ?? detailMarkdown.length;
    sections.set(slug(heading.name), cleanMarkdownDetails(detailMarkdown.slice(heading.end, next)));
  });

  return sections;
}

export function parsePantheonMarkdown(markdown: string): PantheonDeity[] {
  const table = extractNewOrderTable(markdown);
  const details = extractDetailSections(markdown);
  const localCards = localCardMap();

  return table.map((deity) => {
    const local = localCards.get(slug(deity.name));
    return {
      ...deity,
      image: local?.image ?? null,
      href: local?.href ?? getPantheonSourceUrl(),
      details: details.get(slug(deity.name)) ?? null,
    };
  });
}

function readCachedPantheonMarkdown(): string | null {
  try {
    const markdown = fs.readFileSync(PANTHEON_CACHE_PATH, "utf-8");
    return markdown.includes("| Name | Title | Domain(s) |") ? markdown : null;
  } catch {
    return null;
  }
}

export async function getPantheonDeities(): Promise<PantheonDeity[]> {
  const cached = readCachedPantheonMarkdown();
  if (cached) {
    const deities = parsePantheonMarkdown(cached);
    if (deities.length > 0) return deities;
  }

  try {
    const response = await fetch(getPantheonExportUrl(), {
      next: { revalidate: PANTHEON_REVALIDATE_SECONDS },
    });
    if (!response.ok) throw new Error(`Pantheon source returned ${response.status}`);
    const deities = parsePantheonMarkdown(await response.text());
    if (deities.length > 0) return deities;
  } catch {
    // Fall back to saved layout cards so the page remains useful if Google export is unavailable.
  }

  return readLocalPantheonCards();
}
