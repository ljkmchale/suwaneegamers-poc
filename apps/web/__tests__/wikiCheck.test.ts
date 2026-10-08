import { describe, expect, it } from "vitest";
import {
  checkWiki,
  findCampaignBleed,
  findScopeProblems,
  findSpellingVariants,
  findSpoilerLinks,
  folderCampaign,
  type VaultDoc,
} from "@/lib/brain/wikiCheck";

function doc(relativePath: string, campaign: string, links: string[] = [], options: Partial<VaultDoc["metadata"]> & { frontmatter?: Record<string, unknown> } = {}): VaultDoc {
  const { frontmatter = {}, ...metadata } = options;
  return {
    relativePath,
    frontmatter,
    metadata: {
      title: relativePath.split("/").pop()!.replace(/\.md$/, ""),
      campaign,
      visibility: "players",
      links,
      ...metadata,
    },
  };
}

describe("links to DM-only pages", () => {
  it("finds player pages linking to DM pages, and ignores DM pages linking to each other", () => {
    const docs = [
      doc("wiki/entities/Kenton.md", "SoD", ["wiki/threads/Kenton - Goals.md"]),
      doc("wiki/threads/Kenton - Goals.md", "SoD", ["wiki/threads/Other DM.md"], { visibility: "dm" }),
      doc("wiki/threads/Other DM.md", "SoD", [], { visibility: "dm" }),
    ];
    expect(findSpoilerLinks(docs)).toEqual([{ from: "wiki/entities/Kenton.md", to: "wiki/threads/Kenton - Goals.md" }]);
  });
});

describe("campaign bleed", () => {
  it("flags a campaign page linking into another campaign", () => {
    const docs = [doc("wiki/npcs/HoE/Ana.md", "HoE", ["wiki/npcs/SoD/Bo.md", "wiki/world/Myrdae.md"]), doc("wiki/npcs/SoD/Bo.md", "SoD"), doc("wiki/world/Myrdae.md", "World")];
    expect(findCampaignBleed(docs)).toEqual([{ from: "wiki/npcs/HoE/Ana.md", fromCampaign: "HoE", to: "wiki/npcs/SoD/Bo.md", toCampaign: "SoD" }]);
  });

  it("leaves shared, index and map pages alone", () => {
    const docs = [
      doc("wiki/overview.md", "All", ["wiki/npcs/SoD/Bo.md"]),
      doc("wiki/indexes/NPC Index.md", "HoE", ["wiki/npcs/SoD/Bo.md"]),
      doc("wiki/maps/HoE/Relationships.md", "HoE", ["wiki/npcs/SoD/Bo.md"], { browseOnly: true }),
      doc("wiki/npcs/SoD/Bo.md", "SoD"),
    ];
    expect(findCampaignBleed(docs)).toEqual([]);
  });
});

describe("names spelled two ways", () => {
  it("finds apostrophe, spacing and one-letter variants", () => {
    const variants = findSpellingVariants([
      doc("wiki/npcs/HoE/Iuz'Obal.md", "HoE"),
      doc("wiki/npcs/SoD/Iuz Obal.md", "SoD"),
      doc("wiki/world/locations/Aelspire.md", "World"),
      doc("wiki/world/locations/Elspire.md", "World"),
    ]);
    expect(variants.map((variant) => [variant.titles, variant.why])).toEqual([
      [["Iuz'Obal", "Iuz Obal"], "punctuation or spacing"],
      [["Aelspire", "Elspire"], "one letter"],
    ]);
  });

  it("ignores identical names, numbered pages, short names and source copies", () => {
    expect(
      findSpellingVariants([
        doc("wiki/world/locations/Everlight.md", "World"),
        doc("wiki/locations/The Crystal Bottle/Everlight.md", "The Crystal Bottle"),
        doc("wiki/sessions/HoE/HoE Session 01.md", "HoE"),
        doc("wiki/sessions/HoE/HoE Session 02.md", "HoE"),
        doc("wiki/npcs/HoE/Og.md", "HoE"),
        doc("wiki/npcs/HoE/Og2.md", "HoE", [], { title: "Oz" }),
        doc("wiki/gazetteer/Ahndashere.md", "World", [], { title: "Ahndashere (Gazetteer)" }),
        doc("wiki/summaries/Ahndashere Gazetteer.md", "World"),
      ]),
    ).toEqual([]);
  });
});

describe("scope disagreements", () => {
  it("knows a page's campaign from its folder", () => {
    expect(folderCampaign("wiki/npcs/The Crystal Bottle/Malik.md")).toBe("The Crystal Bottle");
    expect(folderCampaign("wiki/world/locations/Adsuren.md")).toBeNull();
  });

  it("reports folder/site mismatches, unknown campaigns and unknown visibility", () => {
    const problems = findScopeProblems([
      doc("wiki/npcs/The Crystal Bottle/Malik.md", "All"),
      doc("wiki/timelines/Wyrm.md", "Wyrm Bane", [], { frontmatter: { campaign: "Wyrm Bane" } }),
      doc("wiki/notes/Secret.md", "All", [], { visibility: "gm-eyes" }),
      doc("wiki/npcs/HoE/Ana.md", "HoE", [], { frontmatter: { campaign: "HoE" } }),
      doc("wiki/world/Myrdae.md", "World", [], { frontmatter: { campaign: "World" } }),
    ]);
    expect(problems.map((problem) => problem.path)).toEqual([
      "wiki/npcs/The Crystal Bottle/Malik.md",
      "wiki/timelines/Wyrm.md",
      "wiki/notes/Secret.md",
    ]);
  });
});

it("puts every check in one report", () => {
  const report = checkWiki([doc("wiki/npcs/HoE/Ana.md", "HoE")]);
  expect(report).toEqual({ pageCount: 1, spoilerLinks: [], campaignBleed: [], spellingVariants: [], scopeProblems: [] });
});
