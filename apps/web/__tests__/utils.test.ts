import { describe, it, expect } from "vitest";
import { cn, truncate, slugify, formatDate, chunkText, capitalize } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("px-2", "px-4")).toBe("px-4"); // tailwind-merge deduplication
  });

  it("handles empty args", () => {
    expect(cn()).toBe("");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("handles conditional class arrays", () => {
    const isActive = true;
    expect(cn("base", isActive && "active")).toBe("base active");
  });

  it("deduplicates conflicting tailwind utilities", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });
});

describe("truncate", () => {
  it("returns short strings as-is", () => {
    expect(truncate("hello", 20)).toBe("hello");
  });

  it("returns string at exact limit unchanged", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
    expect(truncate("hello world", 8).length).toBe(8);
  });

  it("truncates a single-char string to …", () => {
    expect(truncate("abcde", 4)).toBe("a...");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("slugify", () => {
  it("converts to lowercase with hyphens", () => {
    expect(slugify("The Silver Order")).toBe("the-silver-order");
  });

  it("collapses multiple spaces", () => {
    expect(slugify("  multiple   spaces  ")).toBe("multiple-spaces");
  });

  it("strips special characters and collapses hyphens", () => {
    // & and ! are stripped; consecutive hyphens are collapsed to one
    expect(slugify("Dungeons & Dragons!")).toBe("dungeons-dragons");
  });

  it("preserves numbers", () => {
    expect(slugify("Session 27")).toBe("session-27");
  });

  it("handles already-slugified string", () => {
    expect(slugify("heroes-of-emberstran")).toBe("heroes-of-emberstran");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});

describe("capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("does not change already-capitalized string", () => {
    expect(capitalize("World")).toBe("World");
  });

  it("handles empty string", () => {
    expect(capitalize("")).toBe("");
  });

  it("only capitalizes first character", () => {
    expect(capitalize("hello world")).toBe("Hello world");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2025-01-15");
    expect(result).toContain("2025");
    expect(result).toContain("January");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date("2026-06-01T00:00:00Z"));
    expect(result).toContain("2026");
  });

  it("includes the day number", () => {
    // Use a date that avoids timezone-edge ambiguity: mid-month, explicit UTC noon
    const result = formatDate(new Date("2025-03-15T12:00:00Z"));
    expect(result).toMatch(/15/);
  });
});

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    const chunks = chunkText("short text", 2000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("short text");
  });

  it("splits long text into chunks", () => {
    const longText = "a".repeat(10000);
    const chunks = chunkText(longText, 1000); // 1000 tokens ≈ 4000 chars
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("preserves all characters across chunks", () => {
    const longText = "x".repeat(9000);
    const chunks = chunkText(longText, 1000);
    expect(chunks.join("").length).toBe(9000);
  });

  it("each chunk is at most maxTokens * 4 chars", () => {
    const maxTokens = 500;
    const chunks = chunkText("a".repeat(10000), maxTokens);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(maxTokens * 4);
    }
  });

  it("handles text exactly at chunk boundary", () => {
    const text = "a".repeat(4000);
    const chunks = chunkText(text, 1000); // maxChars = 4000
    expect(chunks).toHaveLength(1);
  });

  it("handles empty string", () => {
    expect(chunkText("", 1000)).toHaveLength(0);
  });
});
