import { describe, it, expect } from "vitest";
import { cn, truncate, slugify, formatDate, chunkText } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("px-2", "px-4")).toBe("px-4"); // tailwind-merge deduplication
  });
});

describe("truncate", () => {
  it("returns short strings as-is", () => {
    expect(truncate("hello", 20)).toBe("hello");
  });
  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
    expect(truncate("hello world", 8).length).toBe(8);
  });
});

describe("slugify", () => {
  it("converts to slug", () => {
    expect(slugify("The Silver Order")).toBe("the-silver-order");
    expect(slugify("  multiple   spaces  ")).toBe("multiple-spaces");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2025-01-15");
    expect(result).toContain("2025");
    expect(result).toContain("January");
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
});
