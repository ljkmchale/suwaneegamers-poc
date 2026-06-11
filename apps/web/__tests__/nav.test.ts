import { describe, it, expect } from "vitest";
import { getNavConfig, getNavSection } from "@/lib/nav";

describe("getNavConfig", () => {
  it("returns a config with a sections array", () => {
    const config = getNavConfig();
    expect(Array.isArray(config.sections)).toBe(true);
    expect(config.sections.length).toBeGreaterThan(0);
  });

  it("has primary, world, and tools sections", () => {
    const config = getNavConfig();
    const ids = config.sections.map((s) => s.id);
    expect(ids).toContain("primary");
    expect(ids).toContain("world");
    expect(ids).toContain("tools");
  });

  it("every section has id, label, and items array", () => {
    for (const section of getNavConfig().sections) {
      expect(section.id).toBeTruthy();
      expect(section.label).toBeTruthy();
      expect(Array.isArray(section.items)).toBe(true);
    }
  });

  it("every nav item has id, href, and label", () => {
    for (const section of getNavConfig().sections) {
      for (const item of section.items) {
        expect(item.id,    `item in ${section.id} missing id`).toBeTruthy();
        expect(item.href,  `${item.id} missing href`).toBeTruthy();
        expect(item.label, `${item.id} missing label`).toBeTruthy();
      }
    }
  });

  it("all internal hrefs start with /", () => {
    for (const section of getNavConfig().sections) {
      for (const item of section.items) {
        if (!item.href.startsWith("http")) {
          expect(item.href).toMatch(/^\//);
        }
      }
    }
  });
});

describe("primary nav section", () => {
  it("contains Calendar, Campaigns, and the Map doorway", () => {
    const config = getNavConfig();
    const primary = getNavSection(config, "primary");
    const hrefs = primary.map((i) => i.href);
    expect(hrefs).toContain("/calendar");
    expect(hrefs).toContain("/campaigns");
    expect(hrefs).toContain("/maps-of-myrdae");
  });
});

describe("world nav section", () => {
  it("contains Setting references", () => {
    const config = getNavConfig();
    const world = getNavSection(config, "world");
    const hrefs = world.map((i) => i.href);
    expect(hrefs).toContain("/history");
    expect(hrefs).toContain("/pantheon");
    expect(hrefs).toContain("/bestiary");
    expect(hrefs).toContain("/gazetteer");
    expect(hrefs).toContain("/territories");
  });
});

describe("toolset nav section", () => {
  it("contains the playable reference tools", () => {
    const config = getNavConfig();
    const toolset = getNavSection(config, "toolset-n4ch");
    const hrefs = toolset.map((i) => i.href);
    expect(hrefs).toContain("/campaign-setting");
    expect(hrefs).toContain("/reference-for-dungeon-masters");
    expect(hrefs).toContain("/references");
  });
});

describe("about nav section", () => {
  it("keeps the DM profiles doorway", () => {
    const config = getNavConfig();
    const about = getNavSection(config, "about-e533");
    expect(about.map((i) => i.href)).toContain("/dungeon-masters");
  });
});

describe("getNavSection", () => {
  it("returns items for a known section id", () => {
    const config = getNavConfig();
    const items = getNavSection(config, "primary");
    expect(items.length).toBeGreaterThan(0);
  });

  it("returns empty array for an unknown section id", () => {
    const config = getNavConfig();
    expect(getNavSection(config, "nonexistent")).toEqual([]);
  });
});

describe("nav item ID uniqueness", () => {
  it("all item IDs across all sections are unique", () => {
    const config = getNavConfig();
    const ids = config.sections.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Chronicles navigation", () => {
  it("uses one embedded Chronicles doorway with no Knowledge Base duplicate", () => {
    const items = getNavConfig().sections.flatMap((section) => section.items);
    const chronicles = items.filter((item) => item.label === "Chronicles");

    expect(chronicles).toEqual([
      expect.objectContaining({ href: "/chronicles" }),
    ]);
    expect(items.some((item) => item.label === "Knowledge Base")).toBe(false);
  });
});
