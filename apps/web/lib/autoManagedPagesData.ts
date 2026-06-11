import { readContent, writeContent } from "./contentFiles";
import type { AutoManagedPage } from "./autoManagedPages";

const FILE = "auto-managed-pages.json";

function safeRead(): AutoManagedPage[] {
  try {
    return readContent<AutoManagedPage[]>(FILE) ?? [];
  } catch {
    return [];
  }
}

export function getAutoManagedPages(): AutoManagedPage[] {
  return safeRead();
}

export function lockPage(path: string, label: string): void {
  const pages = safeRead();
  if (pages.some((p) => p.path === path)) return;
  pages.push({
    path,
    label,
    sourceName: "Google Docs",
    sourceUrl: "",
    refreshLabel: "Content is managed from an external source.",
    editNote: "Update the source document to change this page.",
  });
  writeContent(FILE, pages);
}

export function unlockPage(path: string): void {
  writeContent(FILE, safeRead().filter((p) => p.path !== path));
}

/**
 * Extract a Google Calendar ID from embed, ICS, or raw-ID strings.
 * Accepts:
 *   https://calendar.google.com/calendar/embed?src=ID%40group.calendar.google.com
 *   https://calendar.google.com/calendar/ical/ID%40group.../public/basic.ics
 *   ID@group.calendar.google.com  (raw)
 */
export function googleCalendarIdFromUrl(sourceUrl: string): string | null {
  if (!sourceUrl) return null;
  const srcParam = /[?&]src=([^&]+)/.exec(sourceUrl);
  if (srcParam) return decodeURIComponent(srcParam[1]);
  const icsPath = /\/ical\/([^/]+)\//.exec(sourceUrl);
  if (icsPath) return decodeURIComponent(icsPath[1]);
  if (/@/.test(sourceUrl) && !sourceUrl.startsWith("http")) return sourceUrl;
  return null;
}

/**
 * Convert a Google Doc share/edit URL into the plain-text or HTML export URL.
 * Accepts any form: /edit, /view, bare doc ID, or already an export URL.
 */
export function googleDocExportUrl(
  sourceUrl: string,
  format: "html" | "txt" = "html",
): string | null {
  if (!sourceUrl) return null;
  if (sourceUrl.includes("/export?format=")) return sourceUrl;
  const match = /\/document\/d\/([\w-]+)/.exec(sourceUrl);
  if (!match) return null;
  return `https://docs.google.com/document/d/${match[1]}/export?format=${format}`;
}

export function setPageSourceUrl(path: string, url: string): void {
  writeContent(
    FILE,
    safeRead().map((p) => (p.path === path ? { ...p, sourceUrl: url } : p)),
  );
}
