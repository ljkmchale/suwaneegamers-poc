import { describe, expect, it } from "vitest";
import { fuzzyNameMatch } from "@/lib/search";

describe("fuzzyNameMatch", () => {
  it("surfaces a mis-heard name from a by-ear spelling", () => {
    // The exact failures logged in analytics: hunting for Gevakaln.
    expect(fuzzyNameMatch("Gav", "Gevakaln")).toBe(true);
    expect(fuzzyNameMatch("Gava", "Gevakaln")).toBe(true);
    expect(fuzzyNameMatch("Geval", "Gevakaln")).toBe(true);
  });

  it("still matches a clean substring", () => {
    expect(fuzzyNameMatch("shademo", "Shademoor")).toBe(true);
    expect(fuzzyNameMatch("harbo", "Harbok")).toBe(true);
  });

  it("ignores punctuation and case", () => {
    expect(fuzzyNameMatch("qaldynn", "Qal'dynn")).toBe(true);
    expect(fuzzyNameMatch("olmorrey", "Ol'Morrey")).toBe(true);
  });

  it("does not fuzzy-match on 2-char prefixes (too noisy)", () => {
    expect(fuzzyNameMatch("Ga", "Gevakaln")).toBe(false);
  });

  it("rejects unrelated names", () => {
    expect(fuzzyNameMatch("Gevakaln", "Shademoor")).toBe(false);
    expect(fuzzyNameMatch("dragon", "Emberstran")).toBe(false);
  });
});
