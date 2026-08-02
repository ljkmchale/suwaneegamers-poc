import { describe, expect, it } from "vitest";
import { buildWebsiteUpdateSnapshot } from "@/lib/websiteUpdates";

describe("website update snapshot", () => {
  it("uses the configured local timezone to identify today's updates", () => {
    const snapshot = buildWebsiteUpdateSnapshot(
      [
        { kind: "image", name: "/media/images/new.webp", updatedAt: "2026-08-01T04:30:00.000Z" },
        { kind: "content", name: "nav.json", updatedAt: "2026-08-01T03:30:00.000Z" },
      ],
      new Date("2026-08-02T02:00:00.000Z"),
      "America/New_York",
    );

    expect(snapshot.updatedToday).toBe(true);
    expect(snapshot.todayCount).toBe(1);
    expect(snapshot.updatesToday[0]?.name).toBe("/media/images/new.webp");
    expect(snapshot.categories.image.todayCount).toBe(1);
    expect(snapshot.categories.content.todayCount).toBe(0);
  });

  it("keeps the latest update available when nothing changed today", () => {
    const snapshot = buildWebsiteUpdateSnapshot(
      [{ kind: "file", name: "apps/web/app/page.tsx", updatedAt: "2026-07-30T15:00:00.000Z" }],
      new Date("2026-08-01T15:00:00.000Z"),
      "America/New_York",
    );

    expect(snapshot.updatedToday).toBe(false);
    expect(snapshot.latestUpdate?.name).toBe("apps/web/app/page.tsx");
  });
});
