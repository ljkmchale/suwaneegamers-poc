import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { calendarArtwork } from "@/lib/calendarArtwork";

describe("non-campaign calendar artwork", () => {
  it.each(["Ladies' Poker", "Ladies’ Poker", "Ladies Poker Night", "World of Warcraft Forever", "WoW Forever", "Ren Fest", "Georgia Renaissance Festival"])('resolves existing art for %s', (title) => {
    const artwork = calendarArtwork(title);
    expect(artwork).toBeDefined();
    expect(existsSync(join(process.cwd(), artwork!.image))).toBe(true);
  });

  it("leaves unrelated events and campaign headers alone", () => {
    expect(calendarArtwork("Heroes of Emberstran")).toBeUndefined();
    expect(calendarArtwork("Poker strategy workshop")).toBeUndefined();
    expect(calendarArtwork("World of Warcraft Classic")).toBeUndefined();
  });
});
