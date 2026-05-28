import { describe, it, expect } from "vitest";
import { getDungeonMasters, campaignsForDm } from "@/lib/dungeonMasters";
import { getActiveCampaigns } from "@/lib/campaigns";

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
