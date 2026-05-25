import { describe, expect, it } from "vitest";
import { parseIcsEvents } from "@/lib/calendar";

describe("parseIcsEvents", () => {
  it("parses Google Calendar VEVENT entries", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260107T230000Z
DTEND:20260108T030000Z
UID:event-1@google.com
SUMMARY:Heroes of Emberstran
LOCATION:Suwanee
DESCRIPTION:Session night\\nBring dice
END:VEVENT
END:VCALENDAR`);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      uid: "event-1@google.com",
      title: "Heroes of Emberstran",
      location: "Suwanee",
      description: "Session night\nBring dice",
      allDay: false,
    });
    expect(events[0].start).toBe("2026-01-07T23:00:00.000Z");
  });
});
