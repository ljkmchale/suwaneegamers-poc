/**
 * Sync the group's website roadmap into SQLite by fetching the shared
 * "Site: Action Items / Ideas" Google Doc (markdown export) and parsing its
 * per-page enhancement checklist and Ideas wishlist.
 *
 * This feeds Myra's SITE ROADMAP compartment — deliberately separate from the
 * in-world Myrdae lore in her brain and Chronicles. See lib/assistantRoadmap.ts.
 *
 *   npx tsx apps/web/scripts/sync-site-roadmap.ts
 *
 * Read path, in order of preference:
 *   1. SITE_ROADMAP_DOC_MD_FILE — a local markdown export (offline/testing).
 *   2. A configured Google service account — reads privately-shared docs
 *      (share the doc with the service account email; see lib/googleServiceAccount).
 *   3. Anonymous export — only works if the doc is "anyone with the link can view".
 */
import fs from "fs";
import path from "path";
import { writeContent } from "@/lib/contentFiles";
import { parseRoadmapDoc } from "@/lib/assistantRoadmap";
import {
  isServiceAccountConfigured,
  exportGoogleDocMarkdown,
  serviceAccountEmail,
} from "@/lib/googleServiceAccount";
import {
  isUserDriveConnected,
  exportGoogleDocMarkdownAsUser,
} from "@/lib/googleUserToken";

// The scheduler spawns this under tsx with no .env file loaded, so pull in the
// local env ourselves. This job reads config the other syncs don't need:
// SITE_ROADMAP_DOC_MD_FILE (the manual Markdown export the job reads), plus
// GOOGLE_CLIENT_ID/SECRET and a service account key if the parked OAuth/SA read
// paths are ever enabled. Paths resolve from this file's own location
// (apps/web/scripts) so it works regardless of the cwd.
for (const candidate of [
  path.resolve(__dirname, "..", ".env.local"), // apps/web/.env.local
  path.resolve(__dirname, "../../..", ".env.local"), // repo-root .env.local
]) {
  try {
    process.loadEnvFile(candidate);
  } catch {
    // Missing file — fine; the read paths below degrade gracefully.
  }
}

const DOC_ID = process.env.SITE_ROADMAP_DOC_ID
  ?? "10hQeSzBCwnsvq1FGT4r3CG5UR_nBAx8nqMAf4DbHIGI";
const DOC_URL = `https://docs.google.com/document/d/${DOC_ID}/edit`;

async function loadMarkdown(): Promise<string> {
  const localFile = process.env.SITE_ROADMAP_DOC_MD_FILE;
  if (localFile) {
    if (!fs.existsSync(localFile)) {
      throw new Error(
        `SITE_ROADMAP_DOC_MD_FILE points at "${localFile}", which does not exist. `
          + `Export the roadmap doc (File -> Download -> Markdown) to that path.`,
      );
    }
    return fs.readFileSync(localFile, "utf-8");
  }

  // Preferred: read as the connected owner account (reads docs shared privately
  // with that person — e.g. docs Chip shares only with the owner).
  if (isUserDriveConnected()) {
    return exportGoogleDocMarkdownAsUser(DOC_ID);
  }

  // Next: a service account, for docs that can be shared with its robot email.
  if (isServiceAccountConfigured()) {
    return exportGoogleDocMarkdown(DOC_ID);
  }

  const res = await fetch(
    `https://docs.google.com/document/d/${DOC_ID}/export?format=md`,
    { redirect: "follow" },
  );
  if (!res.ok) {
    throw new Error(
      `Roadmap doc export failed: HTTP ${res.status}. Connect the owner's Google `
        + `account at /api/admin/google-drive/connect, or share the doc with the `
        + `service account (${serviceAccountEmail() ?? "not configured"}), set it `
        + `link-viewable, or point SITE_ROADMAP_DOC_MD_FILE at a local export.`,
    );
  }
  return res.text();
}

async function main() {
  const markdown = await loadMarkdown();
  const { actionItems, ideas } = parseRoadmapDoc(markdown);

  // Guard against a silently-broken export (e.g. checkbox syntax changed): the
  // roadmap doc always has action items. Ideas alone may legitimately be empty.
  if (actionItems.length === 0) {
    throw new Error(
      "Roadmap parse produced zero action items — the doc format may have "
        + "changed (checkbox syntax) or the export was empty. Refusing to "
        + "overwrite the stored roadmap with nothing.",
    );
  }

  writeContent("site-roadmap.json", {
    source: DOC_URL,
    syncedAt: new Date().toISOString(),
    actionItems,
    ideas,
  });

  const open = actionItems.filter((item) => !item.done).length;
  const done = actionItems.length - open;
  console.log(
    `[${new Date().toISOString()}] Site roadmap sync: ${actionItems.length} `
      + `action items (${open} open, ${done} done), ${ideas.length} ideas.`,
  );
}

main().catch((error) => {
  console.error("[site-roadmap sync]", error);
  process.exitCode = 1;
});
