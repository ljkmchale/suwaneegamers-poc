import { describe, expect, it } from "vitest";
import {
  filterCalendarEventsForWindow,
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

  it("removes Google Meet boilerplate from DESCRIPTION", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260201T180000Z
UID:meet@test
SUMMARY:Meet Test
DESCRIPTION:Session notes\\n\\nJoin with Google Meet: https://meet.google.com/qdu-ckxo-pym\\n\\nLearn more about Meet at: https://support.google.com/a/users/answer/9282720
END:VEVENT
END:VCALENDAR`);

    expect(events[0].description).toBe("Session notes");
  });

  it("omits DESCRIPTION when it contains only Google Meet boilerplate", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260201T180000Z
UID:meet-only@test
SUMMARY:Meet Only Test
DESCRIPTION:Join with Google Meet: https://meet.google.com/qdu-ckxo-pym\\n\\nLearn more about Meet at: https://support.google.com/a/users/answer/9282720
END:VEVENT
END:VCALENDAR`);

    expect(events[0].description).toBeUndefined();
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

describe("filterCalendarEventsForWindow", () => {
  it("keeps only current and upcoming events within the one-month schedule window", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260608T230000Z
DTEND:20260609T010000Z
UID:past@test
SUMMARY:Past Session
END:VEVENT
BEGIN:VEVENT
DTSTART:20260609T230000Z
DTEND:20260610T010000Z
UID:tonight@test
SUMMARY:Tonight Session
END:VEVENT
BEGIN:VEVENT
DTSTART:20260709T160000Z
DTEND:20260709T170000Z
UID:outside@test
SUMMARY:Outside Window
END:VEVENT
END:VCALENDAR`);

    const filtered = filterCalendarEventsForWindow(events, {
      start: new Date("2026-06-09T12:00:00.000Z"),
      end: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(filtered.map((event) => event.uid)).toEqual(["tonight@test"]);
  });

  it("keeps an event that is already in progress", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260609T100000Z
DTEND:20260609T160000Z
UID:ongoing@test
SUMMARY:Ongoing Session
END:VEVENT
END:VCALENDAR`);

    const filtered = filterCalendarEventsForWindow(events, {
      start: new Date("2026-06-09T12:00:00.000Z"),
      end: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(filtered.map((event) => event.uid)).toEqual(["ongoing@test"]);
  });
});

describe("parseIcsEvents — recurrence expansion", () => {
  it("expands biweekly events inside the requested window", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20260610T180000
DTEND;TZID=America/New_York:20260610T220000
RRULE:FREQ=WEEKLY;INTERVAL=2
UID:silent@test
SUMMARY:Silent Vanguard
END:VEVENT
END:VCALENDAR`, {
      start: new Date("2026-06-09T12:00:00.000Z"),
      end: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(events.map((event) => event.start)).toEqual([
      "2026-06-10T22:00:00.000Z",
      "2026-06-24T22:00:00.000Z",
      "2026-07-08T22:00:00.000Z",
    ]);
  });

  it("gives expanded recurrence instances unique ids", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20260610T180000
DTEND;TZID=America/New_York:20260610T220000
RRULE:FREQ=WEEKLY;INTERVAL=2
UID:recurring@test
SUMMARY:Recurring Session
END:VEVENT
END:VCALENDAR`, {
      start: new Date("2026-06-09T12:00:00.000Z"),
      end: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(new Set(events.map((event) => event.uid)).size).toBe(events.length);
    expect(events.map((event) => event.uid)).toEqual([
      "recurring@test-2026-06-10T22:00:00.000Z",
      "recurring@test-2026-06-24T22:00:00.000Z",
      "recurring@test-2026-07-08T22:00:00.000Z",
    ]);
  });

  it("expands monthly nth-weekday events inside the requested window", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20250918T180000
DTEND;TZID=America/New_York:20250918T223000
RRULE:FREQ=MONTHLY;BYDAY=3TH
UID:adventure@test
SUMMARY:A New Adventure
END:VEVENT
END:VCALENDAR`, {
      start: new Date("2026-06-09T12:00:00.000Z"),
      end: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(events.map((event) => event.start)).toEqual([
      "2026-06-18T22:00:00.000Z",
    ]);
  });

  it("honors recurrence exclusions", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20260604T180000
DTEND;TZID=America/New_York:20260604T223000
RRULE:FREQ=MONTHLY;BYDAY=1TH
EXDATE;TZID=America/New_York:20260702T180000
UID:excluded@test
SUMMARY:Excluded Adventure
END:VEVENT
END:VCALENDAR`, {
      start: new Date("2026-06-09T12:00:00.000Z"),
      end: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(events).toHaveLength(0);
  });

  it("uses moved recurrence instances instead of the original occurrence", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20250515T173000
DTEND;TZID=America/New_York:20250515T220000
RRULE:FREQ=MONTHLY;BYDAY=3TH
UID:moved@test
SUMMARY:A New Adventure
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20260626T173000
DTEND;TZID=America/New_York:20260626T220000
UID:moved@test
RECURRENCE-ID;TZID=America/New_York:20260618T173000
SUMMARY:A New Adventure
END:VEVENT
END:VCALENDAR`, {
      start: new Date("2026-06-09T12:00:00.000Z"),
      end: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(events.map((event) => event.start)).toEqual([
      "2026-06-26T21:30:00.000Z",
    ]);
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
