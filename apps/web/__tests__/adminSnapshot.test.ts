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
  members: {
    days: 7,
    memberCount: 2,
    activeNow: 1,
    list: [
      {
        name: "Michael Hewson",
        email: "michael@example.com",
        lastSeenAt: "2026-08-20T13:29:00.000Z",
        activeNow: true,
        sessions: 3,
        pageViews: 12,
        engagedMinutes: 8,
        topPages: ["/campaigns/heroes-of-emberstran", "/chronicles"],
      },
      {
        name: "Jane Roe",
        email: "jane@example.com",
        lastSeenAt: "2026-08-19T20:00:00.000Z",
        activeNow: false,
        sessions: 1,
        pageViews: 4,
        engagedMinutes: 2,
        topPages: ["/calendar"],
      },
    ],
  },
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

  it("lists who's using the site from the sign-in view, with names and pages", () => {
    expect(block).toContain("Who's using the site (signed-in members, last 7 days");
    expect(block).toContain("NOT the security log");
    expect(block).toContain("2 member(s) active, 1 on right now");
    expect(block).toContain("Michael Hewson (on now)");
    expect(block).toContain("/campaigns/heroes-of-emberstran, /chronicles");
    expect(block).toContain("Jane Roe");
  });

  it("says no members when none were active in the window", () => {
    const quiet = formatAdminSnapshot(
      { ...snapshot, members: { days: 7, memberCount: 0, activeNow: 0, list: [] } },
      "America/New_York",
    );
    expect(quiet).toContain("No signed-in members have been active in this window.");
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
