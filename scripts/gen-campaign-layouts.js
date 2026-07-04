#!/usr/bin/env node
// Generates souls-of-destiny-style layout-card blocks for every campaign
// and writes them into content/page-layouts.json.

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const root = path.join(__dirname, "..");
const dbPath = path.join(root, "content", "suwaneegamers.db");
const layoutsPath = path.join(root, "content", "page-layouts.json");

const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS content_documents (
    path        TEXT PRIMARY KEY,
    json        TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'filesystem'
  );
`);

function readContent(filename) {
  const row = db.prepare(`SELECT json FROM content_documents WHERE path = ?`).get(filename);
  if (row?.json) return JSON.parse(row.json);
  return JSON.parse(fs.readFileSync(path.join(root, "content", filename), "utf-8"));
}

function writeContent(filename, data) {
  const json = JSON.stringify(data, null, 2) + "\n";
  db.prepare(`
    INSERT INTO content_documents (path, json, updated_at, source)
    VALUES (?, ?, ?, 'sync')
    ON CONFLICT(path) DO UPDATE SET
      json = excluded.json,
      updated_at = excluded.updated_at,
      source = excluded.source
  `).run(filename, json, new Date().toISOString());
  const filePath = path.join(root, "content", filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, json, "utf-8");
}

const campaignRows = db.prepare(`SELECT * FROM campaigns ORDER BY rowid`).all();
const summaryRows = db.prepare(`SELECT * FROM session_summaries ORDER BY campaign_id, sort_order`).all();
const layouts = readContent("page-layouts.json");

const summariesByCampaign = new Map();
for (const summary of summaryRows) {
  const list = summariesByCampaign.get(summary.campaign_id) ?? [];
  list.push({
    title: summary.title,
    summary: summary.summary,
    audioLinks: JSON.parse(summary.audio_links ?? "[]"),
    auto: summary.auto ? true : undefined,
    sessionDate: summary.session_date ?? undefined,
  });
  summariesByCampaign.set(summary.campaign_id, list);
}

const campaigns = campaignRows.map((campaign) => ({
  id: campaign.id,
  name: campaign.name,
  dm: campaign.dm,
  schedule: campaign.schedule,
  description: campaign.description,
  headerImage: campaign.header_image,
  headerImagePosition: campaign.header_image_position,
  resources: JSON.parse(campaign.resources ?? "[]"),
  party: JSON.parse(campaign.party ?? "[]"),
  sessionSummaries: summariesByCampaign.get(campaign.id) ?? [],
}));

function slug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function makeResourcesCard(campaignId, resources) {
  const cols = Math.min(resources.length, 3);
  const gridItems = resources.map((r, i) => ({
    id: `resource_${slug(r.label)}_${i + 1}`,
    type: "link",
    props: {
      label: r.label,
      href: r.url,
      variant: i === 0 ? "primary" : "secondary",
      col: String((i % 3) + 1),
      row: String(Math.floor(i / 3) + 1),
      colSpan: "1",
      rowSpan: "1",
    },
  }));

  const rowCount = Math.ceil(resources.length / 3);

  const grid = {
    id: "resources_grid",
    type: "grid",
    props: {
      columns: String(cols),
      rows: String(rowCount),
      gap: "md",
      items: JSON.stringify(gridItems),
    },
  };

  return {
    kind: "block",
    id: `${campaignId}-resources-card`,
    type: "layout-card",
    props: {
      width: "campaign",
      items: JSON.stringify([grid]),
    },
  };
}

function makeRosterCard(campaignId, description, party) {
  const partyRows = party && party.length > 0 ? Math.ceil(party.length / 3) : 0;
  const totalRows = 2 + partyRows;

  const items = [
    {
      id: "notes_header",
      type: "header",
      props: { title: "Notes", color: "primary", size: "md", col: "1", row: "1", colSpan: "3", rowSpan: "1" },
    },
    {
      id: "notes_text",
      type: "text",
      props: { content: description, col: "1", row: "2", colSpan: "3", rowSpan: "1" },
    },
  ];

  if (party && party.length > 0) {
    party.forEach((member, i) => {
      const item = {
        id: `member_${slug(member.name)}_${i + 1}`,
        type: "person",
        props: {
          name: member.name,
          role: member.player,
          variant: "tile",
          col: String((i % 3) + 1),
          row: String(3 + Math.floor(i / 3)),
          colSpan: "1",
          rowSpan: "1",
        },
      };
      if (member.url) item.props.href = member.url;
      items.push(item);
    });
  }

  const grid = {
    id: "notes_roster_grid",
    type: "grid",
    props: {
      columns: "3",
      rows: String(totalRows),
      gap: "md",
      items: JSON.stringify(items),
    },
  };

  return {
    kind: "block",
    id: `${campaignId}-notes-roster-card`,
    type: "layout-card",
    props: {
      width: "campaign",
      items: JSON.stringify([grid]),
    },
  };
}

function makeSessionsCard(campaignId, sessionSummaries) {
  const items = [
    {
      id: "sessions_header",
      type: "header",
      props: { title: "Session Summaries", color: "primary", size: "md", col: "1", row: "1", colSpan: "1", rowSpan: "1" },
    },
  ];

  let currentRow = 2;
  sessionSummaries.forEach((session) => {
    const sessionSlug = slug(session.title);
    items.push({
      id: `${sessionSlug}_title`,
      type: "header",
      props: { title: session.title, color: "gold", size: "md", audioLinks: JSON.stringify(session.audioLinks ?? []), col: "1", row: String(currentRow), colSpan: "1", rowSpan: "1" },
    });
    currentRow++;

    items.push({
      id: `${sessionSlug}_summary`,
      type: "text",
      props: { content: session.summary, col: "1", row: String(currentRow), colSpan: "1", rowSpan: "1" },
    });
    currentRow++;
  });

  const grid = {
    id: "sessions_grid",
    type: "grid",
    props: {
      columns: "1",
      rows: String(currentRow - 1),
      gap: "md",
      items: JSON.stringify(items),
    },
  };

  return {
    kind: "block",
    id: `${campaignId}-sessions-card`,
    type: "layout-card",
    props: {
      width: "campaign",
      items: JSON.stringify([grid]),
    },
  };
}

function buildCampaignLayout(campaign) {
  const id = campaign.id;
  const blocks = [];

  // Back button
  blocks.push({
    kind: "block",
    id: `${id}-back`,
    type: "button-link",
    props: {
      label: "Campaigns",
      href: "/campaigns",
      align: "left",
      variant: "text",
      arrow: "left",
      width: "campaign",
    },
  });

  // Hero
  blocks.push({
    kind: "block",
    id: `${id}-hero`,
    type: "campaign-hero",
    props: {
      eyebrow: "Campaign",
      title: campaign.name,
      image: campaign.headerImage,
      imagePosition: campaign.headerImagePosition || "center",
    },
  });

  // Meta
  blocks.push({
    kind: "block",
    id: `${id}-meta`,
    type: "campaign-meta",
    props: {
      schedule: campaign.schedule,
      dm: campaign.dm,
      campaignName: campaign.name,
    },
  });

  // Resources card
  if (campaign.resources && campaign.resources.length > 0) {
    blocks.push(makeResourcesCard(id, campaign.resources));
  }

  // Notes + Roster card
  blocks.push(makeRosterCard(id, campaign.description, campaign.party));

  // Session summaries card
  if (campaign.sessionSummaries && campaign.sessionSummaries.length > 0) {
    blocks.push(makeSessionsCard(id, campaign.sessionSummaries));
  }

  return blocks;
}

// Rebuild all campaign layouts
for (const campaign of campaigns) {
  const key = `/campaigns/${campaign.id}`;
  layouts[key] = buildCampaignLayout(campaign);
  console.log(`Generated layout for ${key}`);
}

writeContent("page-layouts.json", layouts);
db.close();
console.log("Done. Wrote content/page-layouts.json and content_documents.");
