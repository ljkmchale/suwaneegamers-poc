import { describe, expect, it } from "vitest";
import { formatWarcraftDate, isWarcraftDate } from "@/lib/warcraftDates";

describe("Warcraft calendar dates", () => {
  it("rejects impossible and free-text dates", () => {
    for (const value of ["2026-02-30", "2026-13-01", "2026-1-5", "next Friday", ""]) expect(isWarcraftDate(value)).toBe(false);
    expect(isWarcraftDate("2028-02-29")).toBe(true);
  });
  it("displays the selected calendar day and preserves the existing undecided label", () => {
    expect(formatWarcraftDate("2026-11-06")).toBe("Friday, November 6, 2026");
    expect(formatWarcraftDate("First game night to be decided")).toBe("First game night to be decided");
  });
});
