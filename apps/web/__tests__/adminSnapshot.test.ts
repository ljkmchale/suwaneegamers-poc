import { describe, expect, it } from "vitest";
import {
  formatAdminSnapshot,
  getAdminSnapshotForAgent,
  type AdminSnapshot,
} from "@/lib/adminSnapshot";

const snapshot: AdminSnapshot = {
  capturedAt: "2026-08-20T13:30:00.000Z", // 9:30 AM ET
  feedback: { new: 4, reviewed: 2, total: 11 },
  sync: {
    failed: ["Gazetteer entries"],
    total: 21,
    running: 0,
    lastFinishedAt: "2026-08-20T02:05:00.000Z", // 10:05 PM ET the night before
  },
  security: {
    days: 7,
    failedLogins: 3,
    suspiciousRequests: 9,
    adminRequests: 1,
    topOffenderIp: "203.0.113.7",
    last24h: 5,
  },
  ratings: {
    reviews: 18,
    locations: 6,
    flagged: 1,
    censored: 0,
    latestReviewAt: "2026-08-19T22:14:00.000Z",
  },
  latestContentChange: { name: "content/campaign-roster.json", at: "2026-08-20T02:05:03.000Z" },
};

describe("getAdminSnapshotForAgent gate", () => {
  it("returns an empty string for a non-admin (data never enters metadata)", () => {
    expect(getAdminSnapshotForAgent(false)).toBe("");
  });
});

describe("formatAdminSnapshot", () => {
  const block = formatAdminSnapshot(snapshot, "America/New_York");

  it("labels the block as admin-only and out-of-world", () => {
    expect(block).toContain("ADMIN-ONLY website operations status");
    expect(block).toContain("NOT the Myrdae game world");
  });

  it("anchors answers to local time for 'last night' questions", () => {
    expect(block).toContain("did anything happen last night");
    expect(block).toContain("Overnight & recent activity:");
    // 02:05 UTC renders as the previous evening in America/New_York.
    expect(block).toContain("Last content sync finished Aug 19");
    expect(block).toContain("Security events in the last 24 hours: 5");
    expect(block).toContain("Most recent content change: content/campaign-roster.json");
  });

  it("reports feedback, failed sync jobs, security, and ratings with exact numbers", () => {
    expect(block).toContain("4 new, 2 reviewed, 11 total");
    expect(block).toContain("Gazetteer entries");
    expect(block).toContain("3 failed admin logins");
    expect(block).toContain("18 reviews across 6 locations");
  });

  it("says all-green when no sync jobs failed", () => {
    const green = formatAdminSnapshot(
      { ...snapshot, sync: { failed: [], total: 21, running: 1, lastFinishedAt: snapshot.sync.lastFinishedAt } },
      "America/New_York",
    );
    expect(green).toContain("all jobs green");
    expect(green).toContain("1 running now");
  });
});
