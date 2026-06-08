/**
 * Cross-file content integrity checks.
 * These tests verify referential consistency between content JSON files —
 * things that would silently break at runtime if a rename went wrong.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { getActiveCampaigns } from "@/lib/campaigns";
import { getDungeonMasters } from "@/lib/dungeonMasters";
import { getPlayerProfileSeeds, getPlayerProfiles } from "@/lib/players";
import { getNavConfig } from "@/lib/nav";
import { getPageLayout, getStoredPageLayoutIds } from "@/lib/pageLayouts";
import { PAGE_SECTIONS } from "@/lib/pageSections";
import { getPortalLinks } from "@/lib/portal";
import { buildCampaignDetailLayout, getManagedCampaignDetailPaths } from "@/lib/campaignDetailLayouts";
import type { BlockItem } from "@/lib/pageBlocks";

const campaigns  = getActiveCampaigns();
const dms        = getDungeonMasters();
const players    = getPlayerProfileSeeds();

function findRepoRootForTest() {
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, "content", "page-layouts"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

// ── Campaign ↔ DM cross-references ───────────────────────────────────────────

describe("Campaign DM field → DM profiles", () => {
  it("every campaign's dm field matches a known DM name or a recognised special value", () => {
    const dmNames = new Set(dms.map((d) => d.name));
    // Some campaigns list multiple or rotating DMs using a free-text description
    const ALLOWED_SPECIAL = new Set(["Rotating DMs"]);
    for (const c of campaigns) {
      const isKnownDm      = dmNames.has(c.dm);
      const isSpecialValue = ALLOWED_SPECIAL.has(c.dm);
      expect(
        isKnownDm || isSpecialValue,
        `Campaign "${c.id}" DM "${c.dm}" not found in dungeon-masters.json`,
      ).toBe(true);
    }
  });
});

describe("DM activeCampaignIds → campaigns", () => {
  it("every activeCampaignId references a real campaign", () => {
    const campaignIds = new Set(campaigns.map((c) => c.id));
    for (const dm of dms) {
      for (const cid of dm.activeCampaignIds) {
        expect(
          campaignIds.has(cid),
          `DM "${dm.id}" activeCampaignId "${cid}" not in campaigns.json`,
        ).toBe(true);
      }
    }
  });

  it("every active campaign is claimed by exactly one DM", () => {
    const claimedBy: Record<string, string[]> = {};
    for (const dm of dms) {
      for (const cid of dm.activeCampaignIds) {
        claimedBy[cid] = [...(claimedBy[cid] ?? []), dm.id];
      }
    }
    for (const [cid, owners] of Object.entries(claimedBy)) {
      expect(owners.length, `Campaign "${cid}" is claimed by ${owners.join(", ")}`).toBe(1);
    }
  });
});

// ── Campaign party → players ──────────────────────────────────────────────────

describe("Campaign party → players.json", () => {
  it("every named party member's player is in players.json", () => {
    const playerNames = new Set(players.map((p) => p.name));
    for (const c of campaigns) {
      for (const member of c.party ?? []) {
        if (member.player) {
          expect(
            playerNames.has(member.player),
            `"${member.player}" (${member.name} in "${c.id}") not in players.json`,
          ).toBe(true);
        }
      }
    }
  });

  it("no party member is assigned to more than two characters in the same campaign", () => {
    // One player can have two characters (e.g. retired character + new character,
    // or playing two characters in a single campaign like Silent Vanguard).
    // Three or more would be a data entry mistake.
    for (const c of campaigns) {
      const count = new Map<string, number>();
      for (const member of c.party ?? []) {
        if (!member.player) continue;
        count.set(member.player, (count.get(member.player) ?? 0) + 1);
      }
      for (const [player, n] of count.entries()) {
        expect(
          n,
          `Player "${player}" has ${n} characters in "${c.id}" — expected at most 2`,
        ).toBeLessThanOrEqual(2);
      }
    }
  });
});

// ── Player profile completeness ───────────────────────────────────────────────

describe("Player profile completeness", () => {
  it("every player who appears in a campaign has a profile seed", () => {
    const playerNames = new Set(players.map((p) => p.name));
    for (const c of campaigns) {
      for (const member of c.party ?? []) {
        if (member.player) {
          expect(
            playerNames.has(member.player),
            `"${member.player}" plays in "${c.id}" but has no entry in players.json`,
          ).toBe(true);
        }
      }
    }
  });

  it("every player with assignments in getPlayerProfiles has at least one character", () => {
    for (const profile of getPlayerProfiles()) {
      // profiles without assignments are fine (new players, etc.)
      for (const assignment of profile.assignments) {
        expect(assignment.character.name).toBeTruthy();
        expect(assignment.campaign.id).toBeTruthy();
      }
    }
  });
});

// ── DM profiles ↔ players.json ────────────────────────────────────────────────

describe("DM names → players.json", () => {
  it("every DM who runs an active campaign also has a player profile", () => {
    const playerNames = new Set(players.map((p) => p.name));
    for (const dm of dms) {
      if (dm.activeCampaignIds.length > 0) {
        expect(
          playerNames.has(dm.name),
          `DM "${dm.name}" runs active campaigns but has no players.json entry`,
        ).toBe(true);
      }
    }
  });
});

// ── Nav → internal pages exist ───────────────────────────────────────────────

const KNOWN_INTERNAL_ROUTES = new Set([
  "/", "/calendar", "/campaigns", "/dungeon-masters", "/players",
  "/bestiary", "/setting", "/territories", "/pantheon",
  "/history", "/lore", "/gazetteer", "/maps-of-myrdae",
  "/campaign-setting", "/organizations", "/reference-for-dungeon-masters",
  "/previous-campaigns", "/world", "/test-page",
]);

describe("Nav internal hrefs → known routes", () => {
  it("every internal nav href is a registered app route", () => {
    for (const section of getNavConfig().sections) {
      for (const item of section.items) {
        if (item.href.startsWith("http")) continue; // external links are fine
        expect(
          KNOWN_INTERNAL_ROUTES.has(item.href),
          `Nav item "${item.id}" href "${item.href}" is not in the known routes list`,
        ).toBe(true);
      }
    }
  });
});

// ── Portal links ──────────────────────────────────────────────────────────────

describe("Portal link hrefs — reachability", () => {
  it("all portal link hrefs are non-empty", () => {
    for (const link of getPortalLinks()) {
      expect(link.href.length).toBeGreaterThan(0);
    }
  });

  it("no portal link points to a raw IP address", () => {
    for (const link of getPortalLinks()) {
      expect(link.href).not.toMatch(/https?:\/\/\d+\.\d+\.\d+\.\d+/);
    }
  });
});

describe("Page headers", () => {
  it("keeps portal page headers centered", () => {
    for (const route of KNOWN_INTERNAL_ROUTES) {
      for (const item of getPageLayout(route)) {
        if (item.kind !== "block" || item.type !== "page-header") continue;
        expect(item.props.align, `${route} page header should remain centered`).toBe("center");
      }
    }
  });
});

describe("Stored page layouts", () => {
  it("loads every modular page layout route", () => {
    const storedRoutes = getStoredPageLayoutIds();
    expect(storedRoutes).toContain("/");
    expect(storedRoutes).toContain("/history");
    expect(storedRoutes).toContain("/gazetteer");
    expect(storedRoutes).toContain("/campaigns/a-new-adventure");

    for (const route of storedRoutes) {
      expect(getPageLayout(route).length, `${route} should load layout items`).toBeGreaterThan(0);
    }
  });

  it("loads modular layouts when the app process starts from the repo root", () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(findRepoRootForTest());
      expect(getStoredPageLayoutIds()).toContain("/campaigns");
      expect(getPageLayout("/campaigns").map((item) => item.id)).toContain("campaigns-grid");
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe("Editable campaign detail pages", () => {
  const aggregateDetailBlocks = new Set(["campaign-links", "campaign-roster", "campaign-sessions"]);

  function detailBlocksFor(campaignId: string) {
    return getPageLayout(`/campaigns/${campaignId}`).filter(
      (item): item is BlockItem => item.kind === "block",
    );
  }

  function parseCardLayoutItems(raw: unknown): { id: string; type: string; props: Record<string, unknown> }[] {
    if (typeof raw !== "string") return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function countNestedLayoutItems(blocks: BlockItem[], type: string) {
    let count = 0;
    const visit = (items: { id: string; type: string; props: Record<string, unknown> }[]) => {
      for (const item of items) {
        if (item.type === type) count += 1;
        visit(parseCardLayoutItems(item.props.items));
      }
    };

    for (const block of blocks) {
      if (block.type === "layout-card") visit(parseCardLayoutItems(block.props.items));
    }
    return count;
  }

  it("registers every campaign detail path as a managed editable page", () => {
    expect(getManagedCampaignDetailPaths()).toEqual(
      campaigns.map((campaign) => `/campaigns/${campaign.id}`),
    );
  });

  it("stores each campaign detail page as individually editable assets", () => {
    for (const campaign of campaigns) {
      const blocks = detailBlocksFor(campaign.id);
      const blockTypes = blocks.map((item) => item.type);

      expect(blockTypes).toContain("campaign-hero");
      expect(blockTypes).toContain("campaign-meta");
      expect(blockTypes).toContain("button-link");
      expect(blockTypes.some((type) => aggregateDetailBlocks.has(type))).toBe(false);
      expect(blockTypes.includes("campaign-notes") || blockTypes.includes("layout-card")).toBe(true);

      if (campaign.party?.length) {
        const topLevelRosterCards = blocks.filter((item) => item.type === "card" && item.id.includes("-roster-")).length;
        const nestedRosterPeople = countNestedLayoutItems(blocks, "person");
        expect(topLevelRosterCards + nestedRosterPeople).toBe(campaign.party.length);
      }

      const recordings = (campaign.sessionSummaries ?? []).flatMap((session) => session.audioLinks ?? []);
      if (recordings.length) {
        const topLevelMediaPlayers = blocks.filter((item) => item.type === "media-player").length;
        const nestedMediaPlayers = countNestedLayoutItems(blocks, "media-player");
        const nestedAudioLinks = countNestedLayoutItems(blocks, "audio-link");
        expect(topLevelMediaPlayers + nestedMediaPlayers + nestedAudioLinks).toBe(recordings.length);
        expect(nestedAudioLinks, `${campaign.id} recordings should use the internal media player asset`).toBe(0);
      }

      const sessionSummaryBlocks = blocks.filter((item) => item.id.includes("-session-") && item.id.endsWith("-summary"));
      expect(
        sessionSummaryBlocks.every((item) => item.type === "layout-card"),
        `${campaign.id} session summaries should use the richer card layout asset`,
      ).toBe(true);
    }
  });

  it("builds unsaved campaign fallback layouts from the same editable assets", () => {
    for (const campaign of campaigns) {
      const blockTypes = buildCampaignDetailLayout(campaign)
        .filter((item): item is BlockItem => item.kind === "block")
        .map((item) => item.type);

      expect(blockTypes.some((type) => aggregateDetailBlocks.has(type))).toBe(false);
      expect(blockTypes).toContain("button-link");
      expect(blockTypes).toContain("campaign-hero");
      expect(blockTypes).toContain("campaign-meta");
      expect(blockTypes).toContain("layout-card");
    }
  });
});

describe("Previous campaign archive", () => {
  it("ingests the 11 visible legacy campaigns and their available detail links", () => {
    const cards = getPageLayout("/previous-campaigns").filter(
      (item): item is BlockItem => item.kind === "block" && item.type === "archived-campaign-card",
    );

    expect(cards.map((card) => card.props.title)).toEqual([
      "Beer & Dice",
      "Call for Heroes",
      "Crystal Bottle",
      "Imminent Domain",
      "Legends of Larch",
      "MEAD Society",
      "Middle Earth",
      "Obliged Corpses",
      "Strahd / Avernus",
      "Storm King's Thunder",
      "The Company",
    ]);
    expect(cards.every((card) => card.props.id)).toBe(true);
    expect(cards.filter((card) => card.props.referenceUrl).length).toBe(4);
    expect(cards.filter((card) => card.props.image).length).toBe(11);
  });
});

describe("Pantheon", () => {
  it("renders all deity entries as image cards inside a Bestiary-style grid", () => {
    const layout = getPageLayout("/pantheon");
    const grid = layout.find(
      (item): item is BlockItem => item.kind === "block" && item.type === "card-grid",
    );
    const cards = layout.filter(
      (item): item is BlockItem => item.kind === "block" && item.type === "deity-card",
    );

    expect(grid?.props).toMatchObject({ columns: "3", gap: "md" });
    expect(cards).toHaveLength(29);
    expect(cards.every((card) => card.props.title && card.props.domain && card.props.image)).toBe(true);
  });
});

describe("Editable layout routes", () => {
  it("registers block-only reference pages with the edit overlay", () => {
    for (const route of ["/campaign-setting", "/reference-for-dungeon-masters"]) {
      expect(PAGE_SECTIONS, `${route} should be included in managedPaths`).toHaveProperty(route);
      expect(getPageLayout(route).length, `${route} should have a saved page layout`).toBeGreaterThan(0);
    }
  });
});

describe("History timeline migration", () => {
  it("stores the old site as a timeline bar followed by era folds", () => {
    const timeline = getPageLayout("/history").find(
      (item): item is BlockItem => item.kind === "block" && item.type === "timeline",
    );
    const timelines = getPageLayout("/history").filter(
      (item): item is BlockItem => item.kind === "block" && item.type === "timeline",
    );
    const folds = getPageLayout("/history").filter(
      (item): item is BlockItem => item.kind === "block" && item.type === "fold-header",
    );

    expect(timelines).toHaveLength(1);
    expect(timeline?.props).toMatchObject({ title: "Ages of Myrdae", orientation: "horizontal" });
    expect(JSON.parse(timeline?.props.entries as string).map((entry: { title: string }) => entry.title)).toEqual([
      "Pre-Fracturing",
      "Time of Growth",
      "Cycle of Change",
      "Era of Ascendance",
      "The Awakening",
    ]);
    expect(folds.map((item) => item.props.title)).toEqual([
      "The Awakening: 1227 to Present",
      "Era of Ascendance: 1111 to 1226 AF",
      "Cycle of Change: 942 AF to 1110 AF",
      "Time of Growth: 0 to 941 AF",
      "Pre-Fracturing (PF)",
    ]);

    for (const fold of folds) {
      expect(fold.props.foldLabel).toBe("Open Era Details");
      expect(String(fold.props.foldText).length, `${fold.id} should retain old-site details`).toBeGreaterThan(40);
    }
  });
});
