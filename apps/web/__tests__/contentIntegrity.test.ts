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
import {
  buildCampaignDetailLayout,
  enrichCampaignRosterCard,
  getManagedCampaignDetailPaths,
} from "@/lib/campaignDetailLayouts";
import { getActiveCustomPages } from "@/lib/customPages";
import { parsePantheonMarkdown } from "@/lib/pantheon";
import { getAutoManagedPages, setManagedSourceUrl } from "@/lib/autoManagedPagesData";
import type { BlockItem } from "@/lib/pageBlocks";
import { readContent, writeContent } from "@/lib/contentFiles";
import type { AutoManagedPage } from "@/lib/autoManagedPages";
import { getDmIntroduction } from "@/lib/dmIntroductions";

const campaigns  = getActiveCampaigns();
const dms        = getDungeonMasters();
const players    = getPlayerProfileSeeds();
const ALLOWED_SPECIAL_DM_NAMES = new Set(["Rotating DMs"]);

describe("Dungeon Master introductions", () => {
  it("provides introductions for each named Dungeon Master profile", () => {
    const namedDms = dms.filter((dm) => dm.id !== "rotating-dms");
    for (const dm of namedDms) {
      const introduction = getDmIntroduction(dm.name);
      expect(introduction, dm.name).toBeDefined();
      expect(introduction?.audio).toMatch(/^\/media\/images\/dungeon-masters\/.+\/introduction(?:-[a-z]+)?\.mp3$/);
      expect(introduction?.transcript.length).toBeGreaterThan(100);
    }
  });

  it("grounds Larry's introduction in his DM and player history", () => {
    const introduction = getDmIntroduction("Larry McHale");
    expect(introduction?.transcript).toContain("both sides of the screen");
    expect(introduction?.transcript).toContain("I ran The Crystal Bottle");
  });
});

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
    for (const c of campaigns) {
      const isKnownDm      = dmNames.has(c.dm);
      const isSpecialValue = ALLOWED_SPECIAL_DM_NAMES.has(c.dm);
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

describe("Living Chronicle campaign links", () => {
  it("keeps HOE raw Notes and Living Chronicle as separate adjacent resources", () => {
    const campaign = campaigns.find((item) => item.id === "heroes-of-emberstran");
    const notesIndex = campaign?.resources?.findIndex((resource) => resource.label === "Notes") ?? -1;
    const chroniclesIndex = campaign?.resources?.findIndex((resource) => resource.label === "Chronicles") ?? -1;

    expect(campaign?.resources?.[notesIndex]?.url).toBe(
      "https://docs.google.com/document/d/1ENCKlQLCpkjefs8AgZYXn0_89OgUmJx5ssIFMuOKut4/edit?usp=sharing",
    );
    expect(campaign?.resources?.[chroniclesIndex]?.url).toBe("/campaigns/heroes-of-emberstran/chronicle");
    expect(chroniclesIndex).toBe(notesIndex + 1);
  });

  it("keeps SoD raw Notes and Living Chronicle as separate adjacent resources", () => {
    const campaign = campaigns.find((item) => item.id === "souls-of-destiny");
    const notesIndex = campaign?.resources?.findIndex((resource) => resource.label === "Notes") ?? -1;
    const chroniclesIndex = campaign?.resources?.findIndex((resource) => resource.label === "Chronicles") ?? -1;

    expect(campaign?.resources?.[notesIndex]?.url).toBe(
      "https://docs.google.com/document/d/1pKpiVcOl-mjtJMUD4tuTS6A4UZP3w6ISnehpX8LORH8/edit",
    );
    expect(campaign?.resources?.[chroniclesIndex]?.url).toBe("/campaigns/souls-of-destiny/chronicle");
    expect(chroniclesIndex).toBe(notesIndex + 1);
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
      if (dm.activeCampaignIds.length > 0 && !ALLOWED_SPECIAL_DM_NAMES.has(dm.name)) {
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
  "/", "/calendar", "/campaigns", "/advents_of_harmony", "/dungeon-masters", "/players",
  "/bestiary", "/setting", "/territories", "/pantheon",
  "/history", "/lore", "/gazetteer", "/maps-of-myrdae",
  "/campaign-setting", "/campaign-journeys", "/organizations", "/adventures", "/reference-for-dungeon-masters",
  "/previous-campaigns", "/world", "/test-page",
]);

// Nav placeholders for pages that haven't been built yet. These currently
// 404 — when one gets a real page (app route or custom page), remove it here.
const PLANNED_NAV_ROUTES = new Set([
  "/guides",
]);

describe("Nav internal hrefs → known routes", () => {
  it("every internal nav href is a registered app route, custom page, or known placeholder", () => {
    const customPageRoutes = new Set(
      getActiveCustomPages().map((page) => `/${page.slug}`),
    );

    for (const section of getNavConfig().sections) {
      for (const item of section.items) {
        if (item.href.startsWith("http")) continue; // external links are fine
        expect(
          KNOWN_INTERNAL_ROUTES.has(item.href) ||
            customPageRoutes.has(item.href) ||
            PLANNED_NAV_ROUTES.has(item.href),
          `Nav item "${item.id}" href "${item.href}" is not a known route, custom page, or planned placeholder`,
        ).toBe(true);
      }
    }
  });

  it("planned placeholder routes have not silently become real pages", () => {
    const customPageRoutes = new Set(
      getActiveCustomPages().map((page) => `/${page.slug}`),
    );
    for (const route of PLANNED_NAV_ROUTES) {
      expect(
        customPageRoutes.has(route),
        `"${route}" now exists as a custom page — remove it from PLANNED_NAV_ROUTES`,
      ).toBe(false);
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

  it("keeps each listed campaign visible on the campaigns page", () => {
    const campaignCardIds = getPageLayout("/campaigns")
      .filter((item): item is BlockItem => item.kind === "block" && item.type === "campaign-card")
      .map((item) => item.props.id);

    for (const campaign of campaigns.filter((campaign) => campaign.official !== false)) {
      expect(campaignCardIds, `${campaign.name} should be visible on /campaigns`).toContain(campaign.id);
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

  function parseLinks(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
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

  function countNestedHeaderAudioLinks(blocks: BlockItem[]) {
    let count = 0;
    const visit = (items: { id: string; type: string; props: Record<string, unknown> }[]) => {
      for (const item of items) {
        if (item.type === "header") {
          count += parseLinks(item.props.audioLinks).length;
        }
        visit(parseCardLayoutItems(item.props.items));
      }
    };

    for (const block of blocks) {
      if (block.type === "layout-card") visit(parseCardLayoutItems(block.props.items));
    }
    return count;
  }

  function nestedPeople(blocks: BlockItem[]) {
    const people: { id: string; type: string; props: Record<string, unknown> }[] = [];
    const visit = (items: { id: string; type: string; props: Record<string, unknown> }[]) => {
      for (const item of items) {
        if (item.type === "person") people.push(item);
        visit(parseCardLayoutItems(item.props.items));
      }
    };

    for (const block of blocks) {
      if (block.type === "layout-card") visit(parseCardLayoutItems(block.props.items));
    }
    return people;
  }

  it("registers every campaign detail path as a managed editable page", () => {
    expect(getManagedCampaignDetailPaths()).toEqual(
      campaigns.map((campaign) => `/campaigns/${campaign.id}`),
    );
  });

  it("source-manages every campaign detail path from campaign content or saved overrides", () => {
    const autoManagedPages = getAutoManagedPages();

    for (const campaign of campaigns) {
      const page = autoManagedPages.find((entry) => entry.path === `/campaigns/${campaign.id}`);
      expect(page, `${campaign.id} detail route should be source-managed`).toBeTruthy();
      expect(page?.managedSources?.some((source) => /campaign tracking/i.test(source.label))).toBe(true);
      expect(page?.managedSources?.some((source) => /session summaries/i.test(source.label))).toBe(true);
      expect(page?.managedSources?.some((source) => /campaign headers/i.test(source.label))).toBe(true);
    }
  });

  it("lists both Calendar inputs on the source-managed admin page", () => {
    const calendarPage = getAutoManagedPages().find((entry) => entry.path === "/calendar");

    expect(calendarPage?.managedSources?.some((source) => /google calendar/i.test(source.label))).toBe(true);
    expect(calendarPage?.managedSources?.some((source) => /session summaries/i.test(source.label))).toBe(true);
  });

  it("persists source-link edits for generated campaign detail pages as overrides", () => {
    const originalPages = readContent<AutoManagedPage[]>("auto-managed-pages.json") ?? [];
    const path = `/campaigns/${campaigns[0].id}`;
    const probeUrl = "https://docs.google.com/document/d/campaign-detail-save-probe";

    try {
      writeContent(
        "auto-managed-pages.json",
        originalPages.filter((page) => page.path !== path),
      );

      expect(getAutoManagedPages().find((page) => page.path === path)?.generated).toBe(true);

      setManagedSourceUrl(path, "managedSources.0", probeUrl);

      const savedPages = readContent<AutoManagedPage[]>("auto-managed-pages.json") ?? [];
      const savedPage = savedPages.find((page) => page.path === path);
      expect(savedPage?.generated).toBe(false);
      expect(savedPage?.managedSources?.[0]?.url).toBe(probeUrl);
      expect(getAutoManagedPages().find((page) => page.path === path)?.managedSources?.[0]?.url)
        .toBe(probeUrl);
    } finally {
      writeContent("auto-managed-pages.json", originalPages);
    }
  });

  it("keeps saved campaign roster links in the structured party links shape", () => {
    for (const campaign of campaigns) {
      const people = nestedPeople(detailBlocksFor(campaign.id));

      for (const member of campaign.party ?? []) {
        const person = people.find((item) => item.props.name === member.name);
        expect(person, `${campaign.id} should render ${member.name} in the saved roster`).toBeTruthy();

        expect(parseLinks(person?.props.links)).toEqual(member.links ?? []);
      }
    }
  });

  it("adds character introductions to configured campaign roster tiles only", () => {
    const campaign = campaigns.find((entry) => entry.id === "souls-of-destiny")!;
    const enriched = enrichCampaignRosterCard(detailBlocksFor(campaign.id), campaign)
      .filter((item): item is BlockItem => item.kind === "block");
    const souls = nestedPeople(enriched);
    const kenton = souls.find((item) => item.props.name === "Kenton");
    const therric = souls.find((item) => item.props.name === "Therric");
    const esylla = souls.find((item) => item.props.name === "Esylla");
    const zephyra = souls.find((item) => item.props.name === "Zephyra");
    const lila = souls.find((item) => item.props.name === "Lila");
    const escanor = souls.find((item) => item.props.name === "Escanor");

    expect(kenton?.props.img).toBe("/media/images/characters/kenton-clawstar/portrait.png");
    expect(kenton?.props.introductionAudio).toBe("/media/images/characters/kenton-clawstar/introduction.mp3");
    expect(kenton?.props.introductionVideo).toBe("/media/images/characters/kenton-clawstar/introduction-alive.mp4");
    expect(kenton?.props.introductionText).toContain("If our group is in danger or if there is money to be had");
    expect(therric?.props.img).toBe("/media/images/characters/therric-balenfore/portrait.png");
    expect(therric?.props.introductionAudio).toBe("/media/images/characters/therric-balenfore/introduction.mp3");
    expect(therric?.props.introductionText).toContain("when Kenton has a plan");
    expect(esylla?.props.img).toBe("/media/images/characters/esylla-fordevae/portrait.png");
    expect(esylla?.props.introductionAudio).toBe("/media/images/characters/esylla-fordevae/introduction.mp3");
    expect(esylla?.props.introductionText).toContain("every bargain a price");
    expect(zephyra?.props.img).toBe("/media/images/characters/zephyra-maelstrom/portrait.png");
    expect(zephyra?.props.introductionAudio).toBe("/media/images/characters/zephyra-maelstrom/introduction.mp3");
    expect(zephyra?.props.introductionText).toContain("My rage is mine");
    expect(lila?.props.img).toBe("/media/images/characters/lila-tealeaf/portrait.png");
    expect(lila?.props.introductionAudio).toBe("/media/images/characters/lila-tealeaf/introduction-sunny.mp3");
    expect(lila?.props.introductionText).toContain("It would be very rude of you");
    expect(escanor?.props.img).toBe("/media/images/characters/escanor/portrait.png");
    expect(escanor?.props.introductionAudio).toBe("/media/images/characters/escanor/introduction.mp3");
    expect(escanor?.props.introductionText).toContain("something resembling decency");
    expect(souls.every((item) => item.props.introductionAudio)).toBe(true);
    expect(souls.every((item) => item.props.campaignName === "Souls of Destiny")).toBe(true);

    const heroesCampaign = campaigns.find((entry) => entry.id === "heroes-of-emberstran")!;
    const heroes = nestedPeople(
      enrichCampaignRosterCard(detailBlocksFor(heroesCampaign.id), heroesCampaign)
        .filter((item): item is BlockItem => item.kind === "block"),
    );
    const aurelius = heroes.find((item) => item.props.name === "Aurelius");
    const hap = heroes.find((item) => item.props.name === "Hap");
    const zymve = heroes.find((item) => item.props.name === "Zymve");
    const kytha = heroes.find((item) => item.props.name === "Ky'tha");
    const ainslie = heroes.find((item) => item.props.name === "Ainslie");
    const og = heroes.find((item) => item.props.name === "Og");

    expect(aurelius?.props.img).toBe("/media/images/characters/aurelius-valeheart/portrait.png");
    expect(aurelius?.props.introductionAudio)
      .toBe("/media/images/characters/aurelius-valeheart/introduction.mp3");
    expect(aurelius?.props.introductionText).toContain("My heart, my light, and my life belong to Diverra");
    expect(hap?.props.img).toBe("/media/images/characters/hap-garemon/portrait.png");
    expect(hap?.props.introductionAudio).toBe("/media/images/characters/hap-garemon/introduction.mp3");
    expect(hap?.props.introductionText).toContain("My father Benoit was murdered");
    expect(zymve?.props.img).toBe("/media/images/characters/zymve-inni/portrait.png");
    expect(zymve?.props.introductionAudio).toBe("/media/images/characters/zymve-inni/introduction.mp3");
    expect(zymve?.props.introductionText).toContain("a family I despise");
    expect(kytha?.props.img).toBe("/media/images/characters/kytha-fawnborn/portrait.png");
    expect(kytha?.props.introductionAudio)
      .toBe("/media/images/characters/kytha-fawnborn/introduction.mp3");
    expect(kytha?.props.introductionText).toContain("kindly keep my secrets out of your mouth");
    expect(ainslie?.props.img).toBe("/media/images/characters/ainslie-anaerin/portrait.png");
    expect(ainslie?.props.introductionAudio)
      .toBe("/media/images/characters/ainslie-anaerin/introduction.mp3");
    expect(ainslie?.props.introductionText).toContain("Does that make me one? Not yet");
    expect(og?.props.img).toBe("/media/images/characters/ogmund-crag/portrait.png");
    expect(og?.props.introductionAudio).toBe("/media/images/characters/ogmund-crag/introduction.mp3");
    expect(og?.props.introductionText).toContain("what you refuse to let fall");
    expect(heroes.every((item) => item.props.campaignName === "Heroes of Emberstran")).toBe(true);
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
        const nestedHeaderAudioLinks = countNestedHeaderAudioLinks(blocks);
        expect(nestedHeaderAudioLinks, `${campaign.id} header audio links`).toBe(recordings.length);
        expect(topLevelMediaPlayers + nestedMediaPlayers + nestedAudioLinks, `${campaign.id} legacy audio blocks`).toBe(0);
      }

      const sessionSummaryBlocks = blocks.filter((item) => item.id.includes("-session-") && item.id.endsWith("-summary"));
      expect(
        sessionSummaryBlocks.every((item) => item.type === "layout-card"),
        `${campaign.id} session summaries should use the richer card layout asset`,
      ).toBe(true);
    }
  });

  it("keeps campaign detail hero artwork in sync with shared campaign cards", () => {
    for (const campaign of campaigns) {
      const hero = detailBlocksFor(campaign.id).find((block) => block.type === "campaign-hero");

      expect(hero, `${campaign.id} should have a campaign hero block`).toBeTruthy();
      expect(hero?.props.image, `${campaign.id} hero image should match campaigns.json`).toBe(campaign.headerImage);
      expect(hero?.props.imagePosition ?? "center", `${campaign.id} hero image position should match campaigns.json`)
        .toBe(campaign.headerImagePosition ?? "center");
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
  it("returns archived campaign detail visitors to the main campaigns page", () => {
    const routeSource = fs.readFileSync(
      path.join(
        findRepoRootForTest(),
        "apps",
        "web",
        "app",
        "(site)",
        "previous-campaigns",
        "[id]",
        "page.tsx",
      ),
      "utf-8",
    );

    expect(routeSource).toContain('href="/campaigns"');
    expect(routeSource).not.toContain('href="/previous-campaigns"');
  });

  it("ingests the full campaign status document archive", () => {
    const cards = getPageLayout("/previous-campaigns").filter(
      (item): item is BlockItem => item.kind === "block" && item.type === "archived-campaign-card",
    );

    expect(cards.map((card) => card.props.title)).toEqual([
      "Beer & Dice I",
      "Beer & Dice II",
      "Beer & Dice III",
      "Blisterfel - The Company",
      "Bloody Endeavor I",
      "Call for Heroes",
      "Charlemagne's Angels",
      "Crystal Bottle",
      "Curse of Strahd",
      "Dungeons I - Legends of Larch",
      "Dungeons II - MEAD Society",
      "Imminent Domain",
      "Middle Earth",
      "Myrdaen Misfits",
      "Nomads",
      "Obliged Corpses",
      "Order of the Raven",
      "Plane Shifters",
      "Soulreaper's Reach",
      "Storm King's Thunder",
      "Treasure Hunters",
      "Tyranny of Dragons",
      "Uldrea",
    ]);
    expect(cards.every((card) => card.props.id)).toBe(true);
    expect(cards.filter((card) => card.props.referenceUrl).length).toBe(4);
    expect(cards.filter((card) => card.props.image).length).toBe(23);
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

  it("normalizes Diverra source spelling before attaching saved card art", () => {
    const deities = parsePantheonMarkdown(`
| Name | Title | Domain(s) |
| --- | --- | --- |
| Divera | Ardent One | Love & Beauty |

### Divera

Diverra details.
`);
    const diverra = deities.find((deity) => deity.name === "Diverra");

    expect(diverra).toMatchObject({
      id: "pan-diverra",
      image: "/media/images/pantheon/diverra-symbol.webp",
      details: "Diverra details.",
    });
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
