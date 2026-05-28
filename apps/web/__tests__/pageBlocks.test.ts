import { describe, it, expect } from "vitest";
import {
  ASSET_TYPES,
  CARD_LAYOUT_ITEM_TYPES,
  PROFILE_CARD_ITEM_TYPES,
  getAssetDef,
  type BlockType,
  type AssetTypeDef,
} from "@/lib/pageBlocks";

// All types declared in the BlockType union — update this list whenever a type is added
const ALL_BLOCK_TYPES: BlockType[] = [
  "divider", "card", "image", "text", "callout", "section-heading",
  "button-link", "link-list", "gallery", "embed", "spacer", "quote",
  "page-header", "hero-banner", "portal-links", "founders", "calendar-embed",
  "campaigns-grid", "players-grid", "dms-grid", "bestiary-grid",
  "campaign-card", "player-card", "creature-card",
  "profile-card", "layout-card", "card-grid",
];

// ── Registry completeness ─────────────────────────────────────────────────────

describe("ASSET_TYPES registry — completeness", () => {
  it("has an entry for every BlockType", () => {
    const registered = new Set(ASSET_TYPES.map((a) => a.type));
    for (const type of ALL_BLOCK_TYPES) {
      expect(registered.has(type), `Missing ASSET_TYPE entry for "${type}"`).toBe(true);
    }
  });

  it("has no duplicate type registrations", () => {
    const types = ASSET_TYPES.map((a) => a.type);
    const unique = new Set(types);
    expect(types.length).toBe(unique.size);
  });

  it("covers all three categories", () => {
    const cats = new Set(ASSET_TYPES.map((a) => a.category));
    expect(cats.has("content")).toBe(true);
    expect(cats.has("layout")).toBe(true);
    expect(cats.has("data")).toBe(true);
  });
});

// ── Required shape on every entry ─────────────────────────────────────────────

describe("ASSET_TYPES — required fields on every entry", () => {
  for (const def of ASSET_TYPES) {
    describe(`"${def.type}"`, () => {
      it("has a non-empty label", () => {
        expect(def.label).toBeTruthy();
      });

      it("has a non-empty description", () => {
        expect(def.description).toBeTruthy();
      });

      it("has a non-empty icon", () => {
        expect(def.icon).toBeTruthy();
      });

      it("has a valid category", () => {
        expect(["content", "layout", "data"]).toContain(def.category);
      });

      it("has a defaultProps object", () => {
        expect(def.defaultProps).toBeDefined();
        expect(typeof def.defaultProps).toBe("object");
      });

      it("has a fields array", () => {
        expect(Array.isArray(def.fields)).toBe(true);
      });
    });
  }
});

// ── Field-level invariants ─────────────────────────────────────────────────────

const VALID_FIELD_TYPES = ["text", "textarea", "url", "image", "select", "json", "items", "card-layout-items"];

describe("ASSET_TYPES — field type validity", () => {
  for (const def of ASSET_TYPES) {
    for (const field of def.fields) {
      it(`${def.type}.${field.key} has a valid type ("${field.type}")`, () => {
        expect(VALID_FIELD_TYPES).toContain(field.type);
      });

      if (field.type === "select") {
        it(`${def.type}.${field.key} select has at least one option`, () => {
          expect(field.options?.length).toBeGreaterThan(0);
        });

        it(`${def.type}.${field.key} select options all have value + label`, () => {
          for (const opt of field.options ?? []) {
            expect(opt.value).toBeDefined();
            expect(opt.label).toBeTruthy();
          }
        });
      }
    }
  }
});

// ── getAssetDef ───────────────────────────────────────────────────────────────

describe("getAssetDef", () => {
  it("finds each registered type", () => {
    for (const type of ALL_BLOCK_TYPES) {
      expect(getAssetDef(type), `getAssetDef("${type}") returned undefined`).toBeDefined();
    }
  });

  it("returns the correct entry for a known type", () => {
    const def = getAssetDef("quote");
    expect(def?.label).toBe("Quote");
    expect(def?.category).toBe("content");
  });

  it("returns undefined for an unknown type", () => {
    // @ts-expect-error — intentional bad input for testing
    expect(getAssetDef("does-not-exist")).toBeUndefined();
  });
});

// ── Category filtering ────────────────────────────────────────────────────────

describe("ASSET_TYPES — category membership", () => {
  it("data-category blocks include all grid and single-item live data blocks", () => {
    const data = ASSET_TYPES.filter((a) => a.category === "data").map((a) => a.type);
    expect(data).toContain("campaigns-grid");
    expect(data).toContain("players-grid");
    expect(data).toContain("dms-grid");
    expect(data).toContain("bestiary-grid");
    expect(data).toContain("campaign-card");
    expect(data).toContain("player-card");
    expect(data).toContain("creature-card");
    expect(data).toContain("calendar-embed");
  });

  it("layout-category blocks include page structural blocks", () => {
    const layout = ASSET_TYPES.filter((a) => a.category === "layout").map((a) => a.type);
    expect(layout).toContain("page-header");
    expect(layout).toContain("hero-banner");
    expect(layout).toContain("portal-links");
    expect(layout).toContain("founders");
    expect(layout).toContain("card-grid");
  });

  it("content-category blocks include editable content blocks", () => {
    const content = ASSET_TYPES.filter((a) => a.category === "content").map((a) => a.type);
    expect(content).toContain("divider");
    expect(content).toContain("card");
    expect(content).toContain("image");
    expect(content).toContain("text");
    expect(content).toContain("callout");
    expect(content).toContain("section-heading");
    expect(content).toContain("button-link");
    expect(content).toContain("link-list");
    expect(content).toContain("gallery");
    expect(content).toContain("embed");
    expect(content).toContain("spacer");
    expect(content).toContain("quote");
  });
});

// ── Specific block default props ──────────────────────────────────────────────

describe("defaultProps correctness", () => {
  it("quote has text, attribution, and variant", () => {
    const def = getAssetDef("quote")!;
    expect(def.defaultProps).toMatchObject({ text: "", attribution: "", variant: "gold" });
  });

  it("callout has gold as default variant", () => {
    const def = getAssetDef("callout")!;
    expect(def.defaultProps.variant).toBe("gold");
  });

  it("spacer has md as default size", () => {
    const def = getAssetDef("spacer")!;
    expect(def.defaultProps.size).toBe("md");
  });

  it("divider has ornate as default variant", () => {
    const def = getAssetDef("divider")!;
    expect(def.defaultProps.variant).toBe("ornate");
  });

  it("button-link has primary as default variant", () => {
    const def = getAssetDef("button-link")!;
    expect(def.defaultProps.variant).toBe("primary");
  });

  it("gallery default images prop is valid JSON", () => {
    const def = getAssetDef("gallery")!;
    expect(() => JSON.parse(def.defaultProps.images as string)).not.toThrow();
    const images = JSON.parse(def.defaultProps.images as string);
    expect(Array.isArray(images)).toBe(true);
  });

  it("portal-links default links prop is valid JSON", () => {
    const def = getAssetDef("portal-links")!;
    const links = JSON.parse(def.defaultProps.links as string);
    expect(Array.isArray(links)).toBe(true);
    expect(links[0]).toHaveProperty("href");
  });

  it("founders default founders prop is valid JSON", () => {
    const def = getAssetDef("founders")!;
    const founders = JSON.parse(def.defaultProps.founders as string);
    expect(Array.isArray(founders)).toBe(true);
    expect(founders[0]).toHaveProperty("name");
    expect(founders[0]).toHaveProperty("role");
  });

  it("profile-card default items prop is valid JSON", () => {
    const def = getAssetDef("profile-card")!;
    const items = JSON.parse(def.defaultProps.items as string);
    expect(Array.isArray(items)).toBe(true);
  });

  it("layout-card default items prop is valid JSON with a grid root", () => {
    const def = getAssetDef("layout-card")!;
    const items = JSON.parse(def.defaultProps.items as string);
    expect(Array.isArray(items)).toBe(true);
    expect(items[0].type).toBe("grid");
  });

  it("data blocks with no fields have empty defaultProps", () => {
    const noConfigTypes: BlockType[] = ["campaigns-grid", "players-grid", "dms-grid", "bestiary-grid", "calendar-embed", "hero-banner"];
    for (const type of noConfigTypes) {
      const def = getAssetDef(type)!;
      expect(def.fields).toHaveLength(0);
    }
  });
});

// ── PROFILE_CARD_ITEM_TYPES ───────────────────────────────────────────────────

describe("PROFILE_CARD_ITEM_TYPES", () => {
  const EXPECTED_ITEM_TYPES = [
    "portrait", "image", "heading", "eyebrow", "description",
    "stat", "character-count", "badge", "link", "divider",
    "item-list", "character-list", "next-session", "campaign-info",
  ];

  it("registers all expected profile card item types", () => {
    const registered = PROFILE_CARD_ITEM_TYPES.map((d) => d.type);
    for (const type of EXPECTED_ITEM_TYPES) {
      expect(registered).toContain(type);
    }
  });

  it("every item type def has label and icon", () => {
    for (const def of PROFILE_CARD_ITEM_TYPES) {
      expect(def.label, `${def.type} missing label`).toBeTruthy();
      expect(def.icon, `${def.type} missing icon`).toBeTruthy();
    }
  });

  it("every item type def has a fields array", () => {
    for (const def of PROFILE_CARD_ITEM_TYPES) {
      expect(Array.isArray(def.fields), `${def.type} missing fields array`).toBe(true);
    }
  });
});

// ── CARD_LAYOUT_ITEM_TYPES ────────────────────────────────────────────────────

describe("CARD_LAYOUT_ITEM_TYPES", () => {
  const EXPECTED_TYPES = ["grid", "header", "text", "inner-card", "image", "divider"];

  it("registers all expected card layout item types", () => {
    const registered = CARD_LAYOUT_ITEM_TYPES.map((d) => d.type);
    for (const type of EXPECTED_TYPES) {
      expect(registered).toContain(type);
    }
  });

  it("every card layout item type has grid placement fields", () => {
    const PLACEMENT_KEYS = ["col", "row", "colSpan", "rowSpan"];
    for (const def of CARD_LAYOUT_ITEM_TYPES) {
      const keys = def.fields.map((f) => f.key);
      for (const k of PLACEMENT_KEYS) {
        expect(keys, `${def.type} missing placement field "${k}"`).toContain(k);
      }
    }
  });
});
