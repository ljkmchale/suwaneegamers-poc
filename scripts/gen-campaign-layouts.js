#!/usr/bin/env node
// Generates souls-of-destiny-style layout-card blocks for every campaign
// and writes them into content/page-layouts.json.

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const campaignsPath = path.join(root, "content", "campaigns.json");
const layoutsPath = path.join(root, "content", "page-layouts.json");

const campaigns = JSON.parse(fs.readFileSync(campaignsPath, "utf-8"));
const layouts = JSON.parse(fs.readFileSync(layoutsPath, "utf-8"));

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
      props: { title: session.title, color: "gold", size: "md", col: "1", row: String(currentRow), colSpan: "1", rowSpan: "1" },
    });
    currentRow++;

    items.push({
      id: `${sessionSlug}_summary`,
      type: "text",
      props: { content: session.summary, col: "1", row: String(currentRow), colSpan: "1", rowSpan: "1" },
    });
    currentRow++;

    if (session.audioLinks && session.audioLinks.length > 0) {
      session.audioLinks.forEach((audio, ai) => {
        items.push({
          id: `${sessionSlug}_recording_${ai + 1}`,
          type: "media-player",
          props: { title: audio.label, src: audio.url, mediaType: "auto", displayMode: "image-button", image: "/images/dragon-ears.png", caption: "", col: "1", row: String(currentRow), colSpan: "1", rowSpan: "2" },
        });
        currentRow += 2;
      });
    }
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

fs.writeFileSync(layoutsPath, JSON.stringify(layouts, null, 2));
console.log("Done. Wrote content/page-layouts.json");
