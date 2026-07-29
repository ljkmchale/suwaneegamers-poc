// Refresh the stored sessions-card in each saved campaign page layout from the
// session_summaries table. The live page already splices a fresh card at render
// time (replaceCampaignSessionsCard in apps/web/lib/campaignDetailLayouts.ts),
// but the SAVED layout drifts whenever a session sync adds sessions or audio
// links — which breaks the admin editor's view and the content integrity tests.
//
// Run after session/audio syncs:  node scripts/refresh-campaign-session-cards.mjs
//
// The generated card mirrors buildCampaignSessionsCard() in
// apps/web/lib/campaignDetailLayouts.ts — keep the two in sync.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./sync-db.mjs";
import { readContent, writeContent, contentPath } from "./content-documents.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const layoutsDir = path.join(root, "content", "page-layouts", "campaigns");

function slugPart(value, fallback) {
  return (
    String(value)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

const cardLayoutItems = (items) => JSON.stringify(items, null, 2);

// Mirrors buildCampaignSessionsCard() in apps/web/lib/campaignDetailLayouts.ts.
function buildSessionsCard(campaignId, sessions) {
  if (!sessions.length) return null;

  const sessionItems = [
    {
      id: "sessions_header",
      type: "header",
      props: {
        title: "Session Summaries",
        color: "primary",
        size: "md",
        col: "1",
        row: "1",
        colSpan: "1",
        rowSpan: "1",
      },
    },
  ];
  let row = 2;

  for (const [sessionIndex, session] of sessions.entries()) {
    const sessionSlug = slugPart(session.title, `session-${sessionIndex + 1}`);
    sessionItems.push(
      {
        id: `${sessionSlug}_title`,
        type: "header",
        props: {
          title: session.title,
          color: "gold",
          size: "md",
          audioLinks: cardLayoutItems(session.audioLinks ?? []),
          col: "1",
          row: String(row),
          colSpan: "1",
          rowSpan: "1",
        },
      },
      {
        id: `${sessionSlug}_summary`,
        type: "text",
        props: {
          content: session.summary,
          col: "1",
          row: String(row + 1),
          colSpan: "1",
          rowSpan: "1",
        },
      },
    );
    row += 2;
  }

  return {
    kind: "block",
    id: `${campaignId}-sessions-card`,
    type: "layout-card",
    props: {
      width: "campaign",
      items: cardLayoutItems([
        {
          id: "sessions_grid",
          type: "grid",
          props: {
            columns: "1",
            rows: String(row - 1),
            gap: "md",
            items: cardLayoutItems(sessionItems),
          },
        },
      ]),
    },
  };
}

const db = getDb();
const sessionRows = db
  .prepare(
    `SELECT campaign_id, title, summary, audio_links
     FROM session_summaries
     ORDER BY campaign_id, sort_order`,
  )
  .all();

const byCampaign = new Map();
for (const rowData of sessionRows) {
  const list = byCampaign.get(rowData.campaign_id) ?? [];
  list.push({
    title: rowData.title,
    summary: rowData.summary ?? "",
    audioLinks: JSON.parse(rowData.audio_links ?? "[]"),
  });
  byCampaign.set(rowData.campaign_id, list);
}

let updated = 0;
for (const file of fs.readdirSync(layoutsDir)) {
  if (!file.endsWith(".json")) continue;
  const campaignId = file.replace(/\.json$/, "");
  const sessions = byCampaign.get(campaignId);
  if (!sessions?.length) continue;

  const layoutKey = `page-layouts/campaigns/${file}`;
  if (!fs.existsSync(contentPath(layoutKey))) continue;
  const layout = readContent(layoutKey);
  if (!Array.isArray(layout)) continue;

  const fresh = buildSessionsCard(campaignId, sessions);
  const index = layout.findIndex((item) => item.id === `${campaignId}-sessions-card`);
  const next =
    index >= 0
      ? [...layout.slice(0, index), fresh, ...layout.slice(index + 1)]
      : [...layout, fresh];

  if (JSON.stringify(next) === JSON.stringify(layout)) {
    console.log(`${campaignId}: up to date`);
    continue;
  }
  writeContent(layoutKey, next);
  updated++;
  console.log(`${campaignId}: sessions card refreshed (${sessions.length} sessions)`);
}
console.log(`Done — ${updated} layout(s) updated.`);
