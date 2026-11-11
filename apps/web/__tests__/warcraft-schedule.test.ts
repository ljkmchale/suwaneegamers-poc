import { expect, it } from "vitest";
import { warcraftCalendarNights, warcraftNightDate, warcraftNightTime } from "@/lib/warcraftSchedule";
import type { CalendarEvent } from "@/lib/calendar";

const event = (title: string, start = "2026-11-10T23:30:00Z", end = "2026-11-11T03:30:00Z"): CalendarEvent => ({ uid: title, title, start, end, allDay: false });
it("selects and sorts WoW nights without using descriptions or past events", () => {
  const first = event("World of Warcraft Forever");
  const later = event("WoW Forever", "2026-11-17T23:30:00Z", "2026-11-18T03:30:00Z");
  expect(warcraftCalendarNights([later, { ...event("Poker"), description: "WoW Forever" }, event("WoW", "2026-11-03T23:30:00Z", "2026-11-04T03:30:00Z"), first], new Date("2026-11-05"))).toEqual([first, later]);
});
it("keeps an ongoing night and removes it after it ends", () => {
  expect(warcraftCalendarNights([event("WoW")], new Date("2026-11-11T01:00:00Z"))).toHaveLength(1);
  expect(warcraftCalendarNights([event("WoW")], new Date("2026-11-11T04:00:00Z"))).toHaveLength(0);
});
it("formats the confirmed night in Eastern time and handles all-day events", () => {
  expect(warcraftNightDate(event("WoW"))).toBe("Tuesday, Nov 10");
  expect(warcraftNightTime(event("WoW"))).toBe("6:30 PM – 10:30 PM EST");
  expect(warcraftNightTime({ ...event("WoW"), allDay: true })).toBe("All day");
});
