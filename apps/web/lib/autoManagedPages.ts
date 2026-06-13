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
  /** Primary source URL (e.g. a Google Drive folder or Doc share link). */
  sourceUrl?: string;
  /** Legacy/fallback source URL used when sourceUrl is unavailable or not yet a parseable Google Doc. */
  fallbackSourceUrl?: string;
  refreshLabel: string;
  editNote: string;
}
