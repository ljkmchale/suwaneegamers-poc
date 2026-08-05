import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  formatRoadmapForAgent,
  parseRoadmapDoc,
  type SiteRoadmap,
} from "@/lib/assistantRoadmap";

const fixture = fs.readFileSync(
  path.join(__dirname, "fixtures", "site-roadmap-doc.md"),
  "utf-8",
);

describe("parseRoadmapDoc", () => {
  const { actionItems, ideas } = parseRoadmapDoc(fixture);

  it("captures open and completed action items with their page section", () => {
    const open = actionItems.find((item) =>
      item.text.startsWith("Add how long Campaigns"));
    expect(open).toEqual({
      section: "Campaigns Page",
      text: "Add how long Campaigns have run or have been running",
      done: false,
    });

    const done = actionItems.find((item) => item.text.includes("SETTLEMENT REFERENCES"));
    expect(done?.section).toBe("Setting – Gazetteer Page");
    expect(done?.done).toBe(true);
  });

  it("strips markdown and normalizes curly quotes", () => {
    const gazetteer = actionItems.find((item) => item.done && item.text.includes("GAZETTEER"));
    expect(gazetteer?.text).toBe(
      'Change the purple "GAZETTEER" to "SETTLEMENT REFERENCES"',
    );
  });

  it("ignores empty checkbox lines", () => {
    // "About – Supporting Our Gamers" and the Calendar page have empty items.
    expect(actionItems.some((item) => item.text === "")).toBe(false);
    expect(actionItems.some((item) => item.section === "About – Supporting Our Gamers")).toBe(false);
  });

  it("only reads the Action Items region — not Synchronization or Documents", () => {
    expect(actionItems.some((item) => item.text.includes("under Synchronization"))).toBe(false);
    expect(actionItems.some((item) => item.text.includes("Welcome to Myrdae"))).toBe(false);
    expect(actionItems.some((item) => item.section === "Campaign Setting")).toBe(false);
  });

  it("captures the Ideas wishlist, including nested ideas", () => {
    expect(ideas).toContain("Add a In Memoriam or Fallen Heroes section");
    expect(ideas).toContain("Myrdae Name Generator based on surnames?");
    // The empty first "# Ideas" section and blank bullets contribute nothing.
    expect(ideas.every((idea) => idea.trim().length > 0)).toBe(true);
  });
});

describe("formatRoadmapForAgent", () => {
  const roadmap: SiteRoadmap = {
    source: "https://docs.google.com/document/d/abc/edit",
    syncedAt: "2026-08-05T00:00:00.000Z",
    ...parseRoadmapDoc(fixture),
  };
  const block = formatRoadmapForAgent(roadmap);

  it("frames the roadmap as out-of-world website information", () => {
    expect(block).toContain("real-world information about the Suwanee Gamers WEBSITE");
    expect(block).toContain("NOT part of the Myrdae game world");
  });

  it("separates open, completed, and idea items", () => {
    expect(block).toContain("Requested / open site enhancements");
    expect(block).toContain("already completed");
    expect(block).toContain("Ideas under consideration");
    expect(block).toContain("[Campaigns Page] Add how long Campaigns");
  });

  it("returns an empty string when there is nothing to report", () => {
    expect(formatRoadmapForAgent({ source: "", syncedAt: "", actionItems: [], ideas: [] })).toBe("");
  });
});
