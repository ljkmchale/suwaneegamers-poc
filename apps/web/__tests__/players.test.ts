import { describe, expect, it } from "vitest";
import { getPlayerProfiles, getUnassignedCharacters } from "@/lib/players";

describe("getPlayerProfiles", () => {
  it("builds player profiles from campaign character assignments", () => {
    const players = getPlayerProfiles();
    const larry = players.find((player) => player.name === "Larry McHale");
    const ty = players.find((player) => player.name === "Ty");

    expect(larry).toMatchObject({
      dmProfileId: "larry-mchale",
      assignments: [
        expect.objectContaining({
          character: expect.objectContaining({ name: "Aurelius" }),
          campaign: expect.objectContaining({ id: "heroes-of-emberstran" }),
        }),
      ],
    });

    expect(ty?.assignments).toEqual([
      expect.objectContaining({
        character: expect.objectContaining({ name: "Hap" }),
        campaign: expect.objectContaining({ id: "heroes-of-emberstran" }),
      }),
    ]);
  });
});

describe("getUnassignedCharacters", () => {
  it("keeps unknown player assignments visible for data cleanup", () => {
    const unassignedCharacters = getUnassignedCharacters();

    expect(unassignedCharacters.length).toBeGreaterThan(0);
    expect(unassignedCharacters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          character: expect.objectContaining({ name: "Az'efal" }),
          campaign: expect.objectContaining({ id: "a-new-adventure" }),
        }),
      ]),
    );
  });
});
