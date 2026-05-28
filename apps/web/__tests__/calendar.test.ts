import { describe, expect, it } from "vitest";
import {
  parseIcsEvents,
  googleCalendarEmbedUrl,
  googleCalendarIcsUrl,
  GOOGLE_CALENDAR_ID,
} from "@/lib/calendar";

// ── parseIcsEvents ────────────────────────────────────────────────────────────

describe("parseIcsEvents — basic event", () => {
  it("parses a UTC datetime event", () => {
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

  it("sets allDay = true for 8-digit date-only DTSTART", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260315
DTEND:20260316
UID:all-day@test
SUMMARY:Full Moon Festival
END:VEVENT
END:VCALENDAR`);

    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(true);
    expect(events[0].title).toBe("Full Moon Festival");
  });

  it("omits description when not present", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260201T180000Z
UID:no-desc@test
SUMMARY:Quick Meeting
END:VEVENT
END:VCALENDAR`);

    expect(events[0].description).toBeUndefined();
  });

  it("omits location when not present", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260201T180000Z
UID:no-loc@test
SUMMARY:Remote Session
END:VEVENT
END:VCALENDAR`);

    expect(events[0].location).toBeUndefined();
  });

  it("generates a fallback UID from SUMMARY + DTSTART when UID missing", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260301T200000Z
SUMMARY:The Silent Vanguard
END:VEVENT
END:VCALENDAR`);

    expect(events).toHaveLength(1);
    expect(events[0].uid).toContain("The Silent Vanguard");
  });

  it("skips events with no DTSTART", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:broken@test
SUMMARY:No start date
END:VEVENT
END:VCALENDAR`);

    expect(events).toHaveLength(0);
  });

  it("skips events with no SUMMARY", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260201T180000Z
UID:no-summary@test
END:VEVENT
END:VCALENDAR`);

    expect(events).toHaveLength(0);
  });
});

describe("parseIcsEvents — multiple events", () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260101T200000Z
UID:e1@test
SUMMARY:Campaign One
END:VEVENT
BEGIN:VEVENT
DTSTART:20260108T200000Z
UID:e2@test
SUMMARY:Campaign Two
END:VEVENT
BEGIN:VEVENT
DTSTART:20260115T200000Z
UID:e3@test
SUMMARY:Campaign Three
END:VEVENT
END:VCALENDAR`;

  it("parses all events in order", () => {
    const events = parseIcsEvents(ics);
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.uid)).toEqual(["e1@test", "e2@test", "e3@test"]);
  });

  it("each event has correct title", () => {
    const events = parseIcsEvents(ics);
    expect(events[0].title).toBe("Campaign One");
    expect(events[1].title).toBe("Campaign Two");
    expect(events[2].title).toBe("Campaign Three");
  });
});

describe("parseIcsEvents — line folding", () => {
  it("unfolds continuation lines (RFC 5545 §3.1)", () => {
    // RFC 5545: folding splits at an arbitrary byte; the leading LWSP on the
    // continuation line is the fold marker and is stripped — no space is added.
    const events = parseIcsEvents(
      "BEGIN:VCALENDAR\r\n" +
      "BEGIN:VEVENT\r\n" +
      "DTSTART:20260201T180000Z\r\n" +
      "UID:fold@test\r\n" +
      "SUMMARY:A Very Long Campaign\r\n" +
      " Name That Is Folded\r\n" +
      "END:VEVENT\r\n" +
      "END:VCALENDAR\r\n",
    );

    expect(events).toHaveLength(1);
    // The leading space is stripped from the continuation; no extra space added
    expect(events[0].title).toBe("A Very Long CampaignName That Is Folded");
  });
});

describe("parseIcsEvents — Windows line endings", () => {
  it("handles \\r\\n line endings", () => {
    const events = parseIcsEvents(
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260201T180000Z\r\nUID:crlf@test\r\nSUMMARY:CRLF Event\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n",
    );
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("CRLF Event");
  });
});

describe("parseIcsEvents — ICS text escaping", () => {
  it("decodes \\, escape in DESCRIPTION", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260201T180000Z
UID:esc@test
SUMMARY:Escape Test
DESCRIPTION:Bring snacks\\, dice\\, and character sheets
END:VEVENT
END:VCALENDAR`);
    expect(events[0].description).toBe("Bring snacks, dice, and character sheets");
  });

  it("decodes \\n escape as newline in DESCRIPTION", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260201T180000Z
UID:newline@test
SUMMARY:Newline Test
DESCRIPTION:Line 1\\nLine 2
END:VEVENT
END:VCALENDAR`);
    expect(events[0].description).toBe("Line 1\nLine 2");
  });
});

describe("parseIcsEvents — DTSTART value parameter", () => {
  it("handles DTSTART with TZID parameter (strips param from key)", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20260301T190000
UID:tzid@test
SUMMARY:Local Time Event
END:VEVENT
END:VCALENDAR`);

    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(false);
  });
});

// ── URL helpers ───────────────────────────────────────────────────────────────

describe("googleCalendarEmbedUrl", () => {
  it("returns a valid Google Calendar embed URL", () => {
    const url = googleCalendarEmbedUrl();
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/embed\?/);
  });

  it("includes the calendar ID", () => {
    const url = googleCalendarEmbedUrl();
    expect(decodeURIComponent(url)).toContain(GOOGLE_CALENDAR_ID);
  });

  it("includes AGENDA mode", () => {
    const url = googleCalendarEmbedUrl();
    expect(url).toContain("mode=AGENDA");
  });
});

describe("googleCalendarIcsUrl", () => {
  it("returns a valid Google Calendar ICS URL", () => {
    const url = googleCalendarIcsUrl();
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/ical\//);
    expect(url).toContain("/public/basic.ics");
  });

  it("includes the encoded calendar ID", () => {
    const url = googleCalendarIcsUrl();
    expect(decodeURIComponent(url)).toContain(GOOGLE_CALENDAR_ID);
  });
});
