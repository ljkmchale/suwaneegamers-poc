import { getAutoManagedPages, googleDocExportUrl } from "@/lib/autoManagedPagesData";

export interface HistoryTable {
  headers: string[];
  rows: string[][];
}

export interface HistoryEra {
  id: string;
  title: string;
  description: string;
  years: HistoryTable;
}

export interface HistoryData {
  sourceUrl: string;
  calendarIntro: string[];
  calendarTables: HistoryTable[];
  seasons: {
    description: string[];
    table: HistoryTable | null;
    notableDays: string[];
  };
  hours: string[];
  chronologyIntro: string[];
  eras: HistoryEra[];
}

const DEFAULT_HISTORY_SOURCE_URL =
  "https://docs.google.com/document/d/1PGWzoocfjPNQ69Q-JsVmNXCFo76a3Z_IkcBuBeDj4yQ/edit?tab=t.0#heading=h.5nrncw894vg0";

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\\-/g, "-")
    .replace(/\\\./g, ".")
    .replace(/\\</g, "<")
    .replace(/\\>/g, ">")
    .replace(/\{#[^}]+\}/g, "")
    .replace(/\*\*\[([^\]]+)\]\([^)]+\)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceUrl(): string {
  const entry = getAutoManagedPages().find((page) => page.path === "/history");
  return entry?.sourceUrl || DEFAULT_HISTORY_SOURCE_URL;
}

export function getHistorySourceUrl(): string {
  return sourceUrl();
}

function exportUrl(): string {
  return googleDocExportUrl(sourceUrl(), "md") ?? googleDocExportUrl(DEFAULT_HISTORY_SOURCE_URL, "md")!;
}

function extractChapter(markdown: string): string {
  const start = markdown.indexOf("# **Time & History**");
  if (start < 0) return "";
  const end = markdown.indexOf("# **Faith & Beliefs**", start + 1);
  return markdown.slice(start, end > start ? end : undefined).trim();
}

function sectionBetween(markdown: string, heading: string, nextHeadings: string[]): string {
  const start = markdown.indexOf(heading);
  if (start < 0) return "";
  const bodyStart = markdown.indexOf("\n", start);
  const restStart = bodyStart >= 0 ? bodyStart + 1 : start + heading.length;
  const next = nextHeadings
    .map((nextHeading) => markdown.indexOf(nextHeading, restStart))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  return markdown.slice(restStart, next ?? undefined).trim();
}

function beforeHeadings(markdown: string, headings: string[]): string {
  const next = headings
    .map((heading) => markdown.indexOf(heading))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  return markdown.slice(0, next ?? undefined).trim();
}

function parseMarkdownTable(lines: string[], startIndex: number): { table: HistoryTable; nextIndex: number } | null {
  if (!lines[startIndex]?.trim().startsWith("|")) return null;
  const tableLines: string[] = [];
  let index = startIndex;

  while (index < lines.length && lines[index].trim().startsWith("|")) {
    tableLines.push(lines[index]);
    index++;
  }

  if (tableLines.length < 2) return null;
  const parseRow = (line: string) =>
    line
      .trim()
      .split("|")
      .slice(1, -1)
      .map(stripMarkdown);

  return {
    table: {
      headers: parseRow(tableLines[0]),
      rows: tableLines
        .slice(2)
        .map(parseRow)
        .filter((row) => row.some(Boolean)),
    },
    nextIndex: index,
  };
}

function parseTables(markdown: string): HistoryTable[] {
  const tables: HistoryTable[] = [];
  const lines = markdown.split("\n");
  let index = 0;

  while (index < lines.length) {
    const table = parseMarkdownTable(lines, index);
    if (table) {
      tables.push(table.table);
      index = table.nextIndex;
      continue;
    }
    index++;
  }

  return tables;
}

function paragraphsBeforeFirstTable(markdown: string): string[] {
  const beforeTable = markdown.split("\n|", 1)[0] ?? "";
  return beforeTable
    .split(/\n{2,}/)
    .map(stripMarkdown)
    .filter(Boolean)
    .filter((line) => !line.startsWith("###"));
}

function parseNotableDays(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map(stripMarkdown);
}

function parseEras(chronology: string): { intro: string[]; eras: HistoryEra[] } {
  const firstEra = chronology.search(/^###\s+/m);
  const intro = firstEra >= 0 ? chronology.slice(0, firstEra) : chronology;
  const eraMarkdown = firstEra >= 0 ? chronology.slice(firstEra) : "";
  const headingRegex = /^###\s+(.+?)\s*(?:\{#[^}]+\})?\s*$/gm;
  const headings: Array<{ title: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(eraMarkdown))) {
    headings.push({ title: stripMarkdown(match[1]), start: match.index, end: headingRegex.lastIndex });
  }

  const eras = headings.map((heading, index) => {
    const body = eraMarkdown.slice(heading.end, headings[index + 1]?.start ?? undefined).trim();
    const description = paragraphsBeforeFirstTable(body).join(" ");
    const years = parseTables(body)[0] ?? { headers: ["Year", "Significant Events"], rows: [] };
    return {
      id: slug(heading.title),
      title: heading.title,
      description,
      years,
    };
  });

  return {
    intro: intro.split(/\n{2,}/).map(stripMarkdown).filter(Boolean),
    eras,
  };
}

export function parseHistoryMarkdown(markdown: string): HistoryData {
  const chapter = extractChapter(markdown);
  const harmon = sectionBetween(chapter, "## The Harmon Order (Calendar)", ["## Chronology"]);
  const chronology = sectionBetween(chapter, "## Chronology", []);
  const harmonMain = beforeHeadings(harmon, ["### Seasons"]);
  const seasons = sectionBetween(harmon, "### Seasons", ["### Hours of the Day"]);
  const hours = sectionBetween(harmon, "### Hours of the Day", []);
  const chronologyData = parseEras(chronology);

  return {
    sourceUrl: sourceUrl(),
    calendarIntro: paragraphsBeforeFirstTable(harmonMain),
    calendarTables: parseTables(harmonMain),
    seasons: {
      description: paragraphsBeforeFirstTable(seasons),
      table: parseTables(seasons)[0] ?? null,
      notableDays: parseNotableDays(seasons),
    },
    hours: hours.split(/\n{2,}/).map(stripMarkdown).filter(Boolean),
    chronologyIntro: chronologyData.intro,
    eras: chronologyData.eras,
  };
}

export async function getHistoryData(): Promise<HistoryData> {
  const response = await fetch(exportUrl(), { next: { revalidate: 86400 } });
  if (!response.ok) throw new Error(`History source returned ${response.status}`);
  return parseHistoryMarkdown(await response.text());
}
