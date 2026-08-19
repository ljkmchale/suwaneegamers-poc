import { describe, expect, it } from "vitest";
import {
  formatAdminSnapshot,
  getAdminSnapshotForAgent,
  type AdminSnapshot,
} from "@/lib/adminSnapshot";

const snapshot: AdminSnapshot = {
  feedback: { new: 4, reviewed: 2, total: 11 },
  sync: { failed: ["Gazetteer entries"], total: 21, running: 0 },
  security: {
    days: 7,
    failedLogins: 3,
    suspiciousRequests: 9,
    adminRequests: 1,
    topOffenderIp: "203.0.113.7",
  },
  ratings: {
    reviews: 18,
    locations: 6,
    flagged: 1,
    censored: 0,
    latestReviewAt: "2026-08-18T22:14:00.000Z",
  },
};

describe("getAdminSnapshotForAgent gate", () => {
  it("returns an empty string for a non-admin (data never enters metadata)", () => {
    expect(getAdminSnapshotForAgent(false)).toBe("");
  });
});

describe("formatAdminSnapshot", () => {
  const block = formatAdminSnapshot(snapshot);

  it("labels the block as admin-only and out-of-world", () => {
    expect(block).toContain("ADMIN-ONLY website operations status");
    expect(block).toContain("NOT the Myrdae game world");
  });

  it("reports feedback, failed sync jobs, security, and ratings with exact numbers", () => {
    expect(block).toContain("4 new, 2 reviewed, 11 total");
    expect(block).toContain("1 of 21 nightly jobs FAILED");
    expect(block).toContain("Gazetteer entries");
    expect(block).toContain("3 failed admin logins");
    expect(block).toContain("18 reviews across 6 locations");
    expect(block).toContain("newest 2026-08-18");
  });

  it("says all-green when no sync jobs failed", () => {
    const green = formatAdminSnapshot({ ...snapshot, sync: { failed: [], total: 21, running: 1 } });
    expect(green).toContain("all 21 nightly jobs green");
    expect(green).toContain("1 running now");
  });
});
