import { readContent, writeContent } from "./contentFiles";
import type { AutoManagedPage, ManagedSourceLink } from "./autoManagedPages";
import { getActiveCampaigns, type PortalCampaign } from "./campaigns";

const FILE = "auto-managed-pages.json";

function safeRead(): AutoManagedPage[] {
  try {
    return readContent<AutoManagedPage[]>(FILE) ?? [];
  } catch {
    return [];
  }
}

export function getAutoManagedPages(): AutoManagedPage[] {
  return mergeGeneratedPages(safeRead());
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
  format: "html" | "txt" | "md" = "html",
): string | null {
  if (!sourceUrl) return null;
  if (sourceUrl.includes("/export?format=")) return sourceUrl;
  const match = /\/document\/d\/([\w-]+)/.exec(sourceUrl);
  if (!match) return null;
  return `https://docs.google.com/document/d/${match[1]}/export?format=${format}`;
}

/**
 * Returns the first resolvable Google Doc export URL for the given page path,
 * trying sourceUrl first, then fallbackSourceUrl.
 */
export function getEffectiveDocExportUrl(
  path: string,
  format: "html" | "txt" | "md" = "html",
): string | null {
  const page = safeRead().find((p) => p.path === path);
  if (!page) return null;
  return (
    (page.sourceUrl ? googleDocExportUrl(page.sourceUrl, format) : null) ??
    (page.fallbackSourceUrl ? googleDocExportUrl(page.fallbackSourceUrl, format) : null)
  );
}

export function setPageSourceUrl(path: string, url: string): void {
  const pages = safeRead();
  const existingPage = pages.find((p) => p.path === path);

  if (!existingPage) {
    const generatedPage = campaignDetailManagedPages(pages).find((p) => p.path === path);
    if (generatedPage) {
      writeContent(FILE, [
        ...pages,
        {
          ...generatedPage,
          generated: false,
          sourceUrl: url,
        },
      ]);
      return;
    }
  }

  writeContent(
    FILE,
    pages.map((p) => (p.path === path ? { ...p, sourceUrl: url } : p)),
  );
}

function syncLegacySourceFields(
  page: AutoManagedPage,
  source: ManagedSourceLink,
  url: string,
): AutoManagedPage {
  if (source.role === "primary") return { ...page, sourceUrl: url };
  if (source.role === "fallback") return { ...page, fallbackSourceUrl: url };
  if (/session summaries/i.test(source.label)) return { ...page, fallbackSourceUrl: url };
  return page;
}

export function addManagedSource(path: string, source: Omit<ManagedSourceLink, "key">): void {
  const pages = safeRead();
  const existingPage = pages.find((p) => p.path === path);

  if (!existingPage) {
    const generatedPage = campaignDetailManagedPages(pages).find((p) => p.path === path);
    if (!generatedPage) return;
    writeContent(FILE, [
      ...pages,
      { ...generatedPage, generated: false, managedSources: [...(generatedPage.managedSources ?? []), source] },
    ]);
    return;
  }

  const managedSources = [...(existingPage.managedSources ?? []), source];
  writeContent(FILE, pages.map((p) => (p.path === path ? { ...p, managedSources } : p)));
}

export function removeManagedSource(path: string, index: number): void {
  const pages = safeRead();
  const existingPage = pages.find((p) => p.path === path);
  if (!existingPage?.managedSources) return;
  const managedSources = existingPage.managedSources.filter((_, i) => i !== index);
  writeContent(FILE, pages.map((p) => (p.path === path ? { ...p, managedSources } : p)));
}

export function setManagedSourceUrl(path: string, sourceKey: string, url: string, section?: string): void {
  const pages = safeRead();
  const existingPage = pages.find((page) => page.path === path);
  const pageToUpdate =
    existingPage ??
    campaignDetailManagedPages(pages).find((page) => page.path === path);

  if (!pageToUpdate) return;

  const updatedPage = updateManagedSourceUrl(pageToUpdate, sourceKey, url, section);
  const persistedPage = { ...updatedPage, generated: false };

  if (!existingPage) {
    writeContent(FILE, [...pages, persistedPage]);
    return;
  }

  writeContent(
    FILE,
    pages.map((page) => (page.path === path ? persistedPage : page)),
  );
}

function updateManagedSourceUrl(
  page: AutoManagedPage,
  sourceKey: string,
  url: string,
  section?: string,
): AutoManagedPage {
  if (sourceKey === "sourceUrl") {
    // If a section is provided, promote the legacy field to a managedSources entry so the label is preserved
    if (section) {
      const existing = page.managedSources ?? [];
      const label = existing[0]?.label ?? page.sourceName ?? "Primary Source";
      const managedSources = existing.length > 0
        ? existing.map((s, i) => i === 0 ? { ...s, url, section } : s)
        : [{ label, url, section, role: "primary" as const }];
      return { ...page, sourceUrl: url, managedSources };
    }
    return { ...page, sourceUrl: url };
  }
  if (sourceKey === "fallbackSourceUrl") return { ...page, fallbackSourceUrl: url };

  const match = /^managedSources\.(\d+)$/.exec(sourceKey);
  if (!match || !page.managedSources) return page;

  const index = Number(match[1]);
  const source = page.managedSources[index];
  if (!source) return page;

  const managedSources = page.managedSources.map((item, itemIndex) =>
    itemIndex === index
      ? { ...item, url, ...(section !== undefined ? { section: section || undefined } : {}) }
      : item,
  );

  return syncLegacySourceFields({ ...page, managedSources }, source, url);
}

export function getConfiguredManagedSourceUrl(
  path: string,
  labelPattern: RegExp,
  fallbackUrl: string,
): string {
  const page = safeRead().find((p) => p.path === path);
  const source = page?.managedSources?.find((item) => labelPattern.test(item.label));
  return source?.url || fallbackUrl;
}

function managedSourceIdentity(url: string) {
  const trimmed = url.trim();
  const googleId =
    trimmed.match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1] ??
    trimmed.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)?.[1] ??
    trimmed.match(/\/drive\/folders\/([A-Za-z0-9_-]+)/)?.[1] ??
    trimmed.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1];

  if (googleId) return googleId;
  return trimmed.replace(/[?#].*$/, "").replace(/\/$/, "");
}

function uniqueSources(sources: ManagedSourceLink[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source.url) return false;
    const key = managedSourceIdentity(source.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function campaignLinkSources(campaign: PortalCampaign): ManagedSourceLink[] {
  const sources: ManagedSourceLink[] = [];

  for (const resource of campaign.resources ?? []) {
    sources.push({
      label: resource.label || "Campaign Resource",
      url: resource.url,
      role: /notes?/i.test(resource.label) ? "primary" : "supporting",
    });
  }

  if (campaign.playerNotesUrl) {
    sources.push({
      label: "Player Notes Google Doc",
      url: campaign.playerNotesUrl,
      role: "primary",
    });
  }

  return uniqueSources(sources);
}

function campaignDetailManagedPages(staticPages: AutoManagedPage[]): AutoManagedPage[] {
  const campaignsPage = staticPages.find((page) => page.path === "/campaigns");
  const campaignTrackingUrl =
    campaignsPage?.managedSources?.find((source) => /campaign tracking/i.test(source.label))?.url ??
    campaignsPage?.sourceUrl;
  const sessionSummariesUrl =
    campaignsPage?.managedSources?.find((source) => /session summaries/i.test(source.label))?.url ??
    campaignsPage?.fallbackSourceUrl;
  const campaignHeadersUrl =
    campaignsPage?.managedSources?.find((source) => /campaign headers/i.test(source.label))?.url;

  return getActiveCampaigns().map((campaign) => {
    const managedSources = uniqueSources([
      ...(campaignTrackingUrl
        ? [{
            label: "Campaign Tracking Google Doc",
            url: campaignTrackingUrl,
            role: "primary" as const,
          }]
        : []),
      ...(sessionSummariesUrl
        ? [{
            label: "Session Summaries Google Doc",
            url: sessionSummariesUrl,
            role: "supporting" as const,
          }]
        : []),
      ...(campaignHeadersUrl
        ? [{
            label: "Campaign Headers Google Drive Folder",
            url: campaignHeadersUrl,
            role: "supporting" as const,
          }]
        : []),
      ...campaignLinkSources(campaign),
    ]);

    return {
      path: `/campaigns/${campaign.id}`,
      label: campaign.name,
      sourceName: "Campaign Docs",
      generated: true,
      sourceUrl: managedSources[0]?.url ?? "",
      fallbackSourceUrl: sessionSummariesUrl,
      managedSources,
      refreshLabel: "Campaign detail content is generated from Campaign Tracking, campaign notes, session summaries, and campaign header assets.",
      editNote: "Update the campaign source docs and resource links to change this page. The detail layout is derived from the campaign record.",
    };
  });
}

function mergeGeneratedPages(staticPages: AutoManagedPage[]) {
  const staticPaths = new Set(staticPages.map((page) => page.path));
  const generatedPages = campaignDetailManagedPages(staticPages).filter(
    (page) => !staticPaths.has(page.path),
  );

  return [...staticPages, ...generatedPages];
}
