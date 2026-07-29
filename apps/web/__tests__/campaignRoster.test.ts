import { describe, expect, it } from "vitest";
import {
  findRosterCharacter,
  isDeceased,
  rosterDescriptor,
  rosterStatusLabel,
  type RosterCharacter,
} from "@/lib/campaignRoster";

const roster: RosterCharacter[] = [
  {
    character: 'Teldo "Fungus Roundbelly"',
    player: "Michael Hewson",
    species: "Goliath",
    class: "Warlock",
    subclass: "Archfey Patron",
    level: 9,
    status: "Active",
  },
  {
    character: "Orel Neutruval",
    player: "Larry McHale",
    species: "Half-Elf",
    class: "Cleric",
    subclass: "Life Domain",
    level: 16,
    status: "Deceased",
    deathDate: "4/21/2023",
    notes: "died in Beer & Dice III",
  },
  { character: "Chamber", player: "Larry McHale" },
];

describe("findRosterCharacter", () => {
  it("matches exact names", () => {
    expect(findRosterCharacter(roster, "Chamber")?.player).toBe("Larry McHale");
  });

  it("matches short curated names against full sheet names", () => {
    expect(findRosterCharacter(roster, "Fungus")?.character).toBe('Teldo "Fungus Roundbelly"');
  });

  it("matches full names against shorter roster names", () => {
    expect(findRosterCharacter(roster, "Orel")?.character).toBe("Orel Neutruval");
  });

  it("ignores punctuation and case", () => {
    expect(findRosterCharacter(roster, "orel neutruval")?.level).toBe(16);
  });

  it("returns undefined when nothing matches", () => {
    expect(findRosterCharacter(roster, "Nobody")).toBeUndefined();
    expect(findRosterCharacter(roster, "")).toBeUndefined();
  });

  it("does not match on partial words", () => {
    expect(findRosterCharacter(roster, "Cha")).toBeUndefined();
  });
});

describe("rosterDescriptor", () => {
  it("builds species/class/subclass/level lines", () => {
    expect(rosterDescriptor(roster[1])).toBe("Half-Elf Cleric (Life Domain) · Lv 16");
  });

  it("handles sparse rows", () => {
    expect(rosterDescriptor(roster[2])).toBe("");
    expect(rosterDescriptor({ character: "X", level: 3 })).toBe("Lv 3");
    expect(rosterDescriptor({ character: "X", class: "Monk" })).toBe("Monk");
  });
});

describe("rosterStatusLabel", () => {
  it("appends the death date for deceased characters", () => {
    expect(rosterStatusLabel(roster[1])).toBe("Deceased 4/21/2023");
  });

  it("passes through other statuses", () => {
    expect(rosterStatusLabel(roster[0])).toBe("Active");
    expect(rosterStatusLabel(roster[2])).toBeUndefined();
  });
});

describe("isDeceased", () => {
  it("detects deceased status case-insensitively", () => {
    expect(isDeceased(roster[1])).toBe(true);
    expect(isDeceased(roster[0])).toBe(false);
    expect(isDeceased(roster[2])).toBe(false);
  });
});
