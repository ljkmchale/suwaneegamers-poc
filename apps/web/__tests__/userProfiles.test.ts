import { describe, expect, it } from "vitest";
import { favoriteLocationLabel, rankFavoriteLocations } from "@/lib/userProfiles";

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
