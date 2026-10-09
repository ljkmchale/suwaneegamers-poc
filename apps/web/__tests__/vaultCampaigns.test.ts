import { describe, expect, it } from "vitest";
// The indexer's rule for which campaign a vault page belongs to. Myra and the
// Library filter by this, so a wrong answer hides a page from its own campaign.
import { inferCampaign } from "../brain-tools/src/vault.mjs";

describe("which campaign a vault page belongs to", () => {
  it("uses the campaign folder a page is filed under, including The Crystal Bottle", () => {
    expect(inferCampaign("wiki/npcs/The Crystal Bottle/Malik.md", "# Malik")).toBe("The Crystal Bottle");
    expect(inferCampaign("wiki/locations/The Crystal Bottle/Scarbrook.md", "Mentions HoE once.")).toBe("The Crystal Bottle");
    expect(inferCampaign("wiki/npcs/SoD/Aeolenne.md", "")).toBe("SoD");
  });

  it("uses a campaign named in the file name", () => {
    expect(inferCampaign("wiki/timelines/Bloody Endeavor Timeline.md", "Do not merge events from HoE, SoD.")).toBe("Bloody Endeavor");
    expect(inferCampaign("wiki/summaries/Bloody Endeavor - Campaign Player Notes.md", "HoE and SoD are other campaigns.")).toBe("Bloody Endeavor");
    expect(inferCampaign("wiki/threads/Ren (TCB) - Personal History And Goals.md", "")).toBe("The Crystal Bottle");
  });

  it("reads a Campaign Scope line or section before any passing mention", () => {
    expect(inferCampaign("wiki/concepts/Cult Mechanics.md", "# Cult\n\n## Campaign Scope\n\nSoD. Do not merge with HoE theology.")).toBe("SoD");
    expect(inferCampaign("wiki/concepts/Other.md", "Campaign Scope: Dungeons III\n\nUnlike HoE...")).toBe("Dungeons III");
    expect(inferCampaign("wiki/concepts/Wyrm.md", "Timeline for the Wyrm Bane campaign only. Not HoE.")).toBe("Bloody Endeavor");
  });

  it("keeps front matter, world and shared pages as they were", () => {
    expect(inferCampaign("wiki/npcs/HoE/Ana.md", "", { campaign: "World" })).toBe("World");
    expect(inferCampaign("wiki/world/locations/Adsuren.md", "SoD visited here.")).toBe("World");
    expect(inferCampaign("wiki/overview.md", "HoE")).toBe("All");
    expect(inferCampaign("wiki/concepts/Plain.md", "Nothing campaign-specific.")).toBe("All");
  });
});
