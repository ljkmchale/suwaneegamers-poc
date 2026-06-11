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
  /** URL of the source document (e.g. a Google Doc share link). */
  sourceUrl?: string;
  refreshLabel: string;
  editNote: string;
}
