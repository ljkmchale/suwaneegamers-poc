/**
 * Cross-file content integrity checks.
 * These tests verify referential consistency between content JSON files —
 * things that would silently break at runtime if a rename went wrong.
 */
import { describe, it, expect } from "vitest";
import { getActiveCampaigns } from "@/lib/campaigns";
import { getDungeonMasters } from "@/lib/dungeonMasters";
import { getPlayerProfileSeeds, getPlayerProfiles } from "@/lib/players";
import { getNavConfig } from "@/lib/nav";
import { getPortalLinks } from "@/lib/portal";

const campaigns  = getActiveCampaigns();
const dms        = getDungeonMasters();
const players    = getPlayerProfileSeeds();

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
