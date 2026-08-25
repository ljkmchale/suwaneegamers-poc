import { describe, expect, it } from "vitest";
import { favoriteLocationLabel, matchesRosterName, rankFavoriteLocations } from "@/lib/userProfiles";

describe("user profile settings", () => {
  it("turns visited paths into readable location names", () => {
    expect(favoriteLocationLabel("/campaign-journeys")).toBe("Campaign Journeys");
    expect(favoriteLocationLabel("/")).toBe("Home");
  });

  it("keeps the five most visited public site locations", () => {
    const ranked = rankFavoriteLocations([
      { path: "/calendar", visits: 12 },
      { path: "/admin", visits: 11 },
      { path: "/pantheon", visits: 10 },
      { path: "/campaigns", visits: 9 },
      { path: "/profile", visits: 8 },
      { path: "/history", visits: 7 },
      { path: "/lore", visits: 6 },
      { path: "/players", visits: 5 },
    ]);
    expect(ranked.map((item) => item.path)).toEqual([
      "/calendar",
      "/pantheon",
      "/campaigns",
      "/history",
      "/lore",
    ]);
  });
});

describe("matchesRosterName", () => {
  // The real roster mixes short curated names with fuller sheet names.
  const roster = ["Tom Chernetsky", "Suzanne Chernetsky", "Brian", "Brian Winniford", "Michael Hewson"];

  it("matches an exact full name (case/spacing-insensitive)", () => {
    expect(matchesRosterName("Brian Winniford", roster)).toBe(true);
    expect(matchesRosterName("  michael   hewson ", roster)).toBe(true);
  });

  it("matches a first-name variant by surname + first initial (Thomas -> Tom)", () => {
    expect(matchesRosterName("Thomas Chernetsky", roster)).toBe(true);
  });

  it("does not collapse two different people who share a surname", () => {
    // Suzanne must not be matched to Tom just because both are Chernetsky.
    expect(matchesRosterName("Suzanne Chernetsky", ["Tom Chernetsky"])).toBe(false);
  });

  it("leaves genuinely unknown or ambiguous names off the roster", () => {
    expect(matchesRosterName("Duffy James", roster)).toBe(false);
    // A single initial-only token has no surname to match on.
    expect(matchesRosterName("C M", roster)).toBe(false);
  });
});
