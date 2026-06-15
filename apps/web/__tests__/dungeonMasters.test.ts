import { describe, it, expect } from "vitest";
import fs from "fs";
import { getDungeonMasters, campaignsForDm } from "@/lib/dungeonMasters";
import { getActiveCampaigns } from "@/lib/campaigns";
import { contentPath } from "@/lib/contentFiles";

describe("getDungeonMasters — data shape", () => {
  it("returns a non-empty array", () => {
    expect(getDungeonMasters().length).toBeGreaterThan(0);
  });

  it("every DM has required fields", () => {
    for (const dm of getDungeonMasters()) {
      expect(dm.id,          `${dm.name} missing id`).toBeTruthy();
      expect(dm.name,        `${dm.id} missing name`).toBeTruthy();
      expect(dm.focus,       `${dm.id} missing focus`).toBeTruthy();
      expect(dm.description, `${dm.id} missing description`).toBeTruthy();
    }
  });

  it("DM IDs are unique", () => {
    const dms = getDungeonMasters();
    const ids = dms.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every DM has an activeCampaignIds array", () => {
    for (const dm of getDungeonMasters()) {
      expect(Array.isArray(dm.activeCampaignIds)).toBe(true);
    }
  });

  it("every DM has a previousCampaigns array", () => {
    for (const dm of getDungeonMasters()) {
      expect(Array.isArray(dm.previousCampaigns)).toBe(true);
    }
  });

  it("previousCampaign status values are valid", () => {
    const validStatuses = ["Completed", "On Hiatus"];
    for (const dm of getDungeonMasters()) {
      for (const prev of dm.previousCampaigns) {
        expect(validStatuses, `${dm.id} has bad status "${prev.status}"`).toContain(prev.status);
      }
    }
  });

  it("portrait paths start with /images/ when set", () => {
    for (const dm of getDungeonMasters()) {
      if (dm.portrait) {
        expect(dm.portrait).toMatch(/^\/images\//);
      }
    }
  });
});

describe("getDungeonMasters — cross-reference integrity", () => {
  it("activeCampaignIds reference campaigns that actually exist", () => {
    const campaignIds = new Set(getActiveCampaigns().map((c) => c.id));
    for (const dm of getDungeonMasters()) {
      for (const cid of dm.activeCampaignIds) {
        expect(
          campaignIds.has(cid),
          `DM "${dm.id}" references unknown campaign "${cid}"`,
        ).toBe(true);
      }
    }
  });
  it("has a DM profile for every active campaign DM", () => {
    const dmNames = new Set(getDungeonMasters().map((dm) => dm.name));

    for (const campaign of getActiveCampaigns()) {
      for (const dmName of campaign.dm.split(/\s*&\s*/)) {
        expect(
          dmNames.has(dmName),
          `Missing DM profile for active campaign DM "${dmName}"`,
        ).toBe(true);
      }
    }
  });

  it("includes every active campaign assigned to each DM", () => {
    const campaigns = getActiveCampaigns();

    for (const dm of getDungeonMasters()) {
      const expectedIds = campaigns
        .filter((campaign) => campaign.dm.split(/\s*&\s*/).includes(dm.name))
        .map((campaign) => campaign.id)
        .sort();
      const actualIds = [...dm.activeCampaignIds].sort();

      expect(actualIds, `${dm.name} active campaign list is incomplete`).toEqual(expectedIds);
    }
  });

  it("includes every archived campaign assigned to each DM", () => {
    const archivedBlocks = JSON.parse(
      fs.readFileSync(contentPath("page-layouts/previous-campaigns.json"), "utf-8"),
    ).filter((block: { type?: string }) => block.type === "archived-campaign-card");

    for (const dm of getDungeonMasters()) {
      const expectedCampaigns = archivedBlocks
        .filter((block: { props: { dm: string } }) =>
          block.props.dm.split(/\s*&\s*/).includes(dm.name),
        )
        .map((block: { props: { title: string; status: string } }) => ({
          name: block.props.title,
          status: block.props.status,
        }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
      const actualCampaigns = dm.previousCampaigns
        .map((campaign) => ({
          name: campaign.name,
          status: campaign.status,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      expect(actualCampaigns, `${dm.name} archived campaign list is incomplete`).toEqual(
        expectedCampaigns,
      );
    }
  });

  it("renders every active campaign in the saved dungeon-masters layout", () => {
    const layoutBlocks = JSON.parse(
      fs.readFileSync(contentPath("page-layouts/dungeon-masters.json"), "utf-8"),
    ).filter((block: { type?: string }) => block.type === "profile-card");
    const campaignsById = new Map(getActiveCampaigns().map((campaign) => [campaign.id, campaign]));

    for (const dm of getDungeonMasters()) {
      const card = layoutBlocks.find((block: { props: { items: string } }) =>
        JSON.parse(block.props.items).some(
          (item: { type?: string; props?: { value?: string } }) =>
            item.type === "heading" && item.props?.value === dm.name,
        ),
      );

      expect(card, `Missing saved layout card for ${dm.name}`).toBeTruthy();

      const items = JSON.parse(card.props.items);
      const activeList = items.find(
        (item: { type?: string; props?: { title?: string } }) =>
          item.type === "item-list" && item.props?.title === "Active Campaigns",
      );
      const renderedTitles = activeList
        ? JSON.parse(activeList.props.entries).map((entry: { title: string }) => entry.title)
        : [];
      const expectedTitles = dm.activeCampaignIds.map((id) => campaignsById.get(id)?.name);

      expect(renderedTitles, `${dm.name} saved layout active campaigns are incomplete`).toEqual(
        expectedTitles,
      );
    }
  });

  it("renders every archived campaign in the saved dungeon-masters layout", () => {
    const layoutBlocks = JSON.parse(
      fs.readFileSync(contentPath("page-layouts/dungeon-masters.json"), "utf-8"),
    ).filter((block: { type?: string }) => block.type === "profile-card");

    for (const dm of getDungeonMasters()) {
      const card = layoutBlocks.find((block: { props: { items: string } }) =>
        JSON.parse(block.props.items).some(
          (item: { type?: string; props?: { value?: string } }) =>
            item.type === "heading" && item.props?.value === dm.name,
        ),
      );

      expect(card, `Missing saved layout card for ${dm.name}`).toBeTruthy();

      const items = JSON.parse(card.props.items);
      const historyList = items.find(
        (item: { type?: string; props?: { title?: string } }) =>
          item.type === "item-list" && item.props?.title === "Campaign History",
      );
      const renderedCampaigns = historyList
        ? JSON.parse(historyList.props.entries).map(
            (entry: { title: string; status: string }) => ({
              name: entry.title,
              status: entry.status,
            }),
          )
        : [];
      const expectedCampaigns = dm.previousCampaigns.map((campaign) => ({
        name: campaign.name,
        status: campaign.status,
      }));

      expect(renderedCampaigns, `${dm.name} saved layout archive is incomplete`).toEqual(
        expectedCampaigns,
      );
    }
  });
});

describe("campaignsForDm", () => {
  it("returns campaigns matching the DM's activeCampaignIds", () => {
    for (const dm of getDungeonMasters()) {
      const campaigns = campaignsForDm(dm);
      expect(campaigns.length).toBe(dm.activeCampaignIds.length);
      for (const c of campaigns) {
        expect(dm.activeCampaignIds).toContain(c.id);
      }
    }
  });

  it("returns empty array for a DM with no active campaigns", () => {
    const fakeDm = { ...getDungeonMasters()[0], activeCampaignIds: [] };
    expect(campaignsForDm(fakeDm)).toEqual([]);
  });
});
