import { describe, expect, it } from "vitest";
import { formatUpdatesForAgent, type SiteUpdate } from "@/lib/assistantUpdates";

const updates: SiteUpdate[] = [
  {
    date: "2026-08-18",
    area: "site",
    title: "Location & business ratings on the Map of Myrdae",
    detail: "Leave an in-character review and star rating for places.",
  },
  {
    date: "2026-08-08",
    area: "myra",
    title: "Myra has her own voice",
    detail: "Members can pick a persona for how she sounds.",
  },
];

describe("formatUpdatesForAgent", () => {
  const block = formatUpdatesForAgent(updates);

  it("frames the changelog as out-of-world website information", () => {
    expect(block).toContain("real-world information about recent CHANGES");
    expect(block).toContain("NOT part of the Myrdae game world");
  });

  it("leads with the most recent change date", () => {
    expect(block).toContain("Most recent change shipped: 2026-08-18.");
  });

  it("tags site features and Myra capabilities distinctly", () => {
    expect(block).toContain("2026-08-18 [site] Location & business ratings");
    expect(block).toContain("2026-08-08 [Myra] Myra has her own voice");
  });

  it("returns an empty string when there is nothing to report", () => {
    expect(formatUpdatesForAgent([])).toBe("");
  });
});
