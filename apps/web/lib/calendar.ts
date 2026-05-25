export interface CalendarEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end?: string;
  allDay: boolean;
}

export const GOOGLE_CALENDAR_ID =
  process.env.GOOGLE_CALENDAR_ID ??
  process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID ??
  "g3kgagicusaol82fqhjc62o47o@group.calendar.google.com";

export const GOOGLE_CALENDAR_COLOR =
  process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_COLOR ?? "#fa573c";

export const GOOGLE_CALENDAR_TIMEZONE =
  process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_TIMEZONE ?? "America/New_York";

export function googleCalendarEmbedUrl(): string {
  const params = new URLSearchParams({
    color: GOOGLE_CALENDAR_COLOR,
    ctz: GOOGLE_CALENDAR_TIMEZONE,
    mode: "AGENDA",
    showCalendars: "0",
    showPrint: "0",
    showTabs: "1",
    src: GOOGLE_CALENDAR_ID,
  });

  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}

export function googleCalendarIcsUrl(): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(
    GOOGLE_CALENDAR_ID
  )}/public/basic.ics`;
}

export async function fetchUpcomingCalendarEvents(limit = 8): Promise<CalendarEvent[]> {
  const res = await fetch(googleCalendarIcsUrl(), {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Google Calendar feed returned ${res.status}`);
  }

  const ics = await res.text();
  const now = new Date();

  return parseIcsEvents(ics)
    .filter((event) => new Date(event.end ?? event.start) >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, limit);
}

export function parseIcsEvents(ics: string): CalendarEvent[] {
  const lines = unfoldIcsLines(ics);
  const events: CalendarEvent[] = [];
  let current: Record<string, string> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (current?.DTSTART && current.SUMMARY) {
        const start = parseIcsDate(current.DTSTART);
        const end = current.DTEND ? parseIcsDate(current.DTEND) : undefined;

        if (start) {
          events.push({
            uid: current.UID ?? `${current.SUMMARY}-${current.DTSTART}`,
            title: decodeIcsText(current.SUMMARY),
            description: current.DESCRIPTION ? decodeIcsText(current.DESCRIPTION) : undefined,
            location: current.LOCATION ? decodeIcsText(current.LOCATION) : undefined,
            start: start.toISOString(),
            end: end?.toISOString(),
            allDay: current.DTSTART.length === 8,
          });
        }
      }
      current = null;
      continue;
    }

    if (!current) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const rawKey = line.slice(0, separator);
    const value = line.slice(separator + 1);
    const key = rawKey.split(";")[0];

    current[key] = value;
  }

  return events;
}

function unfoldIcsLines(ics: string): string[] {
  const rawLines = ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine) continue;

    if ((rawLine.startsWith(" ") || rawLine.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += rawLine.slice(1);
    } else {
      lines.push(rawLine);
    }
  }

  return lines;
}

function parseIcsDate(value: string): Date | null {
  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }

  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second, utc] = match;

  if (utc) {
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      )
    );
  }

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

function decodeIcsText(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}
