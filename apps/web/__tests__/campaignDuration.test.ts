import { describe, expect, it } from "vitest";
import { formatCampaignDuration } from "@/lib/campaignDuration";

describe("formatCampaignDuration", () => {
  it("formats completed campaign durations as years and months", () => {
    expect(formatCampaignDuration("2023-05", "2025-11")).toBe("2 years 6 months");
  });

  it("uses elapsed full months when day precision is available", () => {
    expect(formatCampaignDuration("2025-03-19", "2026-08-05")).toBe("1 year 4 months");
  });

  it("handles campaigns newer than a month", () => {
    expect(formatCampaignDuration("2026-08-01", "2026-08-05")).toBe("0 months");
  });

  it("does not invent a duration when a date is absent or invalid", () => {
    expect(formatCampaignDuration(undefined, "2026-08-05")).toBeNull();
    expect(formatCampaignDuration("not-a-date", "2026-08-05")).toBeNull();
  });
});

