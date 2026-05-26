import { describe, expect, it } from "vitest";
import { getPlayerProfiles, getUnassignedCharacters } from "@/lib/players";

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
});

describe("getUnassignedCharacters", () => {
  it("has no remaining unassigned campaign characters", () => {
    const unassignedCharacters = getUnassignedCharacters();

    expect(unassignedCharacters).toEqual([]);
  });
});
