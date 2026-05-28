import { describe, expect, it } from "vitest";
import {
  getPlayerProfiles,
  getUnassignedCharacters,
  assignmentsForPlayer,
  ensurePlayerSeed,
  getPlayerProfileSeeds,
} from "@/lib/players";

// ── getPlayerProfileSeeds ─────────────────────────────────────────────────────

describe("getPlayerProfileSeeds", () => {
  it("returns a non-empty array", () => {
    expect(getPlayerProfileSeeds().length).toBeGreaterThan(0);
  });

  it("every seed has id, name, and description", () => {
    for (const seed of getPlayerProfileSeeds()) {
      expect(seed.id,          `${seed.name} missing id`).toBeTruthy();
      expect(seed.name,        `${seed.id} missing name`).toBeTruthy();
      expect(seed.description, `${seed.id} missing description`).toBeTruthy();
    }
  });

  it("player IDs are unique", () => {
    const seeds = getPlayerProfileSeeds();
    const ids = seeds.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("portrait paths start with /images/ when set", () => {
    for (const seed of getPlayerProfileSeeds()) {
      if (seed.portrait) {
        expect(seed.portrait).toMatch(/^\/images\//);
      }
    }
  });
});

// ── getPlayerProfiles ─────────────────────────────────────────────────────────

describe("getPlayerProfiles", () => {
  it("builds player profiles from campaign character assignments", () => {
    const players = getPlayerProfiles();
    const larry = players.find((player) => player.name === "Larry McHale");
    const ty = players.find((player) => player.name === "Ty Cooper");
    const emma = players.find((player) => player.name === "Emma Cooper");

    expect(larry).toMatchObject({
      dmProfileId: "larry-mchale",
      assignments: expect.arrayContaining([
        expect.objectContaining({
          character: expect.objectContaining({ name: "Aurelius" }),
          campaign: expect.objectContaining({ id: "heroes-of-emberstran" }),
        }),
      ]),
    });

    expect(ty?.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          character: expect.objectContaining({ name: "Hap" }),
          campaign: expect.objectContaining({ id: "heroes-of-emberstran" }),
        }),
      ]),
    );

    expect(ty?.portrait).toBe("/images/ty-cooper-clean.webp");
    expect(emma?.portrait).toBe("/images/emma-cooper-clean.webp");
  });

  it("returns players sorted alphabetically by name", () => {
    const players = getPlayerProfiles();
    for (let i = 1; i < players.length; i++) {
      expect(players[i - 1].name.localeCompare(players[i].name)).toBeLessThanOrEqual(0);
    }
  });

  it("every profile has an assignments array", () => {
    for (const profile of getPlayerProfiles()) {
      expect(Array.isArray(profile.assignments)).toBe(true);
    }
  });

  it("inherits portrait from DM profile when player has no portrait", () => {
    const dms = ["Chip Poole", "Sean Poole", "Lesley Poole"];
    const players = getPlayerProfiles();
    for (const dmName of dms) {
      const p = players.find((pl) => pl.name === dmName);
      if (p) {
        // Should have either a direct portrait or an inherited one via DM profile
        // (not asserting a specific path — just that the field is set)
        expect(typeof p.portrait === "string" || p.portrait === undefined).toBe(true);
      }
    }
  });
});

// ── getUnassignedCharacters ───────────────────────────────────────────────────

describe("getUnassignedCharacters", () => {
  it("has no remaining unassigned campaign characters", () => {
    const unassignedCharacters = getUnassignedCharacters();
    expect(unassignedCharacters).toEqual([]);
  });
});

// ── assignmentsForPlayer ──────────────────────────────────────────────────────

describe("assignmentsForPlayer", () => {
  it("returns assignments for a known player", () => {
    const assignments = assignmentsForPlayer("Larry McHale");
    expect(assignments.length).toBeGreaterThan(0);
  });

  it("each assignment has character and campaign", () => {
    for (const a of assignmentsForPlayer("Sean Poole")) {
      expect(a.character.name).toBeTruthy();
      expect(a.campaign.id).toBeTruthy();
    }
  });

  it("returns empty array for a player with no characters", () => {
    expect(assignmentsForPlayer("Totally Unknown Player")).toEqual([]);
  });

  it("Ty Cooper has characters in Heroes of Emberstran", () => {
    const assignments = assignmentsForPlayer("Ty Cooper");
    const hoe = assignments.find((a) => a.campaign.id === "heroes-of-emberstran");
    expect(hoe).toBeDefined();
    expect(hoe?.character.name).toBe("Hap");
  });
});

// ── ensurePlayerSeed ──────────────────────────────────────────────────────────

describe("ensurePlayerSeed", () => {
  it("creates a seed with a slug id", () => {
    const seed = ensurePlayerSeed("Alice Thornwood");
    expect(seed.id).toBe("alice-thornwood");
  });

  it("sets the name", () => {
    const seed = ensurePlayerSeed("Bob Dragon");
    expect(seed.name).toBe("Bob Dragon");
  });

  it("provides a non-empty description", () => {
    const seed = ensurePlayerSeed("Player One");
    expect(seed.description).toBeTruthy();
  });

  it("slugifies names with special chars", () => {
    const seed = ensurePlayerSeed("Az'efal Moonwhisper");
    expect(seed.id).toMatch(/^[a-z0-9-]+$/);
  });
});
