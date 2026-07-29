// Verify that session recordings used by the UI point to existing local files.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./sync-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Session audio lives under apps/web/media/session-audio (outside public/) and
// is served dynamically by the route handler. The URL keeps its /media/... form,
// so joining it under apps/web resolves to the on-disk file.
const mediaBase = path.join(root, "apps", "web");
const db = getDb();
const failures = [];
let recordingCount = 0;

for (const row of db.prepare(
  "SELECT campaign_id, title, audio_links FROM session_summaries WHERE audio_links != '[]' ORDER BY campaign_id, sort_order",
).all()) {
  const links = JSON.parse(row.audio_links ?? "[]");
  for (const link of links) {
    recordingCount += 1;
    if (!link.url?.startsWith("/media/session-audio/")) {
      failures.push(`${row.campaign_id} / ${row.title}: remote or invalid URL ${link.url ?? "(missing)"}`);
      continue;
    }
    const pathname = link.url.split(/[?#]/, 1)[0];
    const localPath = path.join(mediaBase, ...pathname.split("/").filter(Boolean));
    if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
      failures.push(`${row.campaign_id} / ${row.title}: missing local file ${link.url}`);
    }
    if (!link.sourceFileId || !link.sourceUrl) {
      failures.push(`${row.campaign_id} / ${row.title}: missing Drive provenance for ${link.url}`);
    }
  }
}

if (failures.length) {
  console.error("Local session-audio audit failed:");
  failures.forEach((failure) => console.error(`  ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Local session-audio audit passed: ${recordingCount} recording(s) cached with Drive provenance.`);
}
