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
 * The doc must be link-viewable ("anyone with the link can view"), like every
 * other synced Google Doc — the scheduler has no per-user Google auth. For
 * offline seeding/testing, point SITE_ROADMAP_DOC_MD_FILE at a local markdown
 * export instead of hitting Google.
 */
import fs from "fs";
import { writeContent } from "@/lib/contentFiles";
import { parseRoadmapDoc } from "@/lib/assistantRoadmap";

const DOC_ID = process.env.SITE_ROADMAP_DOC_ID
  ?? "10hQeSzBCwnsvq1FGT4r3CG5UR_nBAx8nqMAf4DbHIGI";
const DOC_URL = `https://docs.google.com/document/d/${DOC_ID}/edit`;

async function loadMarkdown(): Promise<string> {
  const localFile = process.env.SITE_ROADMAP_DOC_MD_FILE;
  if (localFile) {
    return fs.readFileSync(localFile, "utf-8");
  }
  const res = await fetch(
    `https://docs.google.com/document/d/${DOC_ID}/export?format=md`,
    { redirect: "follow" },
  );
  if (!res.ok) {
    throw new Error(
      `Roadmap doc export failed: HTTP ${res.status}. The doc must be shared `
        + `"anyone with the link can view" for the scheduler to read it.`,
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
