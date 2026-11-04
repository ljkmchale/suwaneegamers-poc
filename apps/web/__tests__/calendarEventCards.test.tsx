import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { googleCalendarEmbedUrl } from "@/lib/calendar";
import CalendarPage from "@/app/(site)/calendar/page";

vi.mock("@/lib/campaigns", () => ({
  getActiveCampaigns: () => [],
  findCampaignForCalendarEvent: () => undefined,
  findPreviousCampaignEvent: () => undefined,
}));
vi.mock("@/lib/campaignTracking", () => ({ getTrackedActiveCampaigns: () => [] }));
vi.mock("@/app/(site)/calendar/RunicBackground", () => ({ RunicBackground: () => null }));
vi.mock("@/lib/calendar", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/calendar")>(),
  fetchRecentCalendarEvents: async () => [],
  fetchUpcomingCalendarEvents: async () => ["Ladies' Poker", "World of Warcraft Forever", "Ren Fest"].map((title, i) => ({
    title, uid: String(i), start: "2026-11-21T18:00:00Z", allDay: false,
  })),
}));

describe("calendar event cards", () => {
  it("renders artwork and working calendar links for non-campaign events", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(await CalendarPage());
    const cards = container.querySelectorAll("article");
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.querySelector("img")).not.toBeNull();
      expect(card.querySelector("h3 a")?.getAttribute("href")).toBe(googleCalendarEmbedUrl());
      expect(card.querySelector("a")?.getAttribute("href")).toBe(googleCalendarEmbedUrl());
    }
    expect(container.innerHTML).not.toContain("/campaigns/calendar");
  });
});
