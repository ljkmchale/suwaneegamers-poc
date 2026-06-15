/**
 * Type definition for pages whose content is generated from an external source
 * instead of the manual page layout editor.
 *
 * Keep this client-safe: no fs calls, no server-only imports.
 * Runtime data lives in content/auto-managed-pages.json via lib/autoManagedPagesData.ts.
 */

export interface AutoManagedPage {
  path: string;
  label: string;
  sourceName: string;
  /** True when the source-managed entry is derived from another content file. */
  generated?: boolean;
  /** Primary source URL (e.g. a Google Drive folder or Doc share link). */
  sourceUrl?: string;
  /** Legacy/fallback source URL used when sourceUrl is unavailable or not yet a parseable Google Doc. */
  fallbackSourceUrl?: string;
  /** Explicit list of all external sources that contribute to this page. */
  managedSources?: ManagedSourceLink[];
  refreshLabel: string;
  editNote: string;
}

export interface ManagedSourceLink {
  key?: string;
  label: string;
  url: string;
  role?: "primary" | "fallback" | "supporting";
}

function sourceLabel(sourceName: string) {
  if (sourceName === "Google Calendar") return "Google Calendar";
  if (sourceName === "Google Drive") return "Google Drive Folder";
  if (sourceName === "Map Editor") return "Map Editor";
  if (sourceName === "Campaign Brain") return "Campaign Brain";
  return sourceName || "Primary Source";
}

export function getManagedSourceLinks(page: AutoManagedPage): ManagedSourceLink[] {
  if (page.managedSources?.length) {
    return page.managedSources
      .map((source, index) => ({ ...source, key: `managedSources.${index}` }))
      .filter((source) => source.url);
  }

  const links: ManagedSourceLink[] = [];

  if (page.sourceUrl) {
    links.push({
      key: "sourceUrl",
      label: sourceLabel(page.sourceName),
      url: page.sourceUrl,
      role: "primary",
    });
  }

  if (page.fallbackSourceUrl) {
    links.push({
      key: "fallbackSourceUrl",
      label: "Fallback Google Doc",
      url: page.fallbackSourceUrl,
      role: "fallback",
    });
  }

  return links;
}
