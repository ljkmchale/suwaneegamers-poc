export interface CalendarEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end?: string;
  allDay: boolean;
}

interface RawIcsEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  rrule?: string;
  exdates: Date[];
  recurrenceId?: Date;
}

interface CalendarWindow {
  start: Date;
  end: Date;
}

export const LIVE_CALENDAR_WINDOW_MONTHS = 1;

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

export function addCalendarMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function liveCalendarWindow(now = new Date()) {
  return {
    start: now,
    end: addCalendarMonths(now, LIVE_CALENDAR_WINDOW_MONTHS),
  };
}

export function filterCalendarEventsForWindow(
  events: CalendarEvent[],
  window: CalendarWindow = liveCalendarWindow(),
): CalendarEvent[] {
  const startMs = window.start.getTime();
  const endMs = window.end.getTime();

  return events
    .filter((event) => {
      const eventStartMs = new Date(event.start).getTime();
      const eventEndMs = new Date(event.end ?? event.start).getTime();

      return eventEndMs >= startMs && eventStartMs <= endMs;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export async function fetchUpcomingCalendarEvents(limit?: number): Promise<CalendarEvent[]> {
  const res = await fetch(googleCalendarIcsUrl(), {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Google Calendar feed returned ${res.status}`);
  }

  const ics = await res.text();
  const window = liveCalendarWindow();
  const events = filterCalendarEventsForWindow(parseIcsEvents(ics, window), window);

  return typeof limit === "number" ? events.slice(0, limit) : events;
}

export function parseIcsEvents(ics: string, recurrenceWindow?: CalendarWindow): CalendarEvent[] {
  const lines = unfoldIcsLines(ics);
  const rawEvents: RawIcsEvent[] = [];
  let current: Record<string, string[]> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      const rawEvent = current ? rawEventFromProperties(current) : null;
      if (rawEvent) rawEvents.push(rawEvent);
      current = null;
      continue;
    }

    if (!current) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const rawKey = line.slice(0, separator);
    const value = line.slice(separator + 1);
    const key = rawKey.split(";")[0];

    current[key] = [...(current[key] ?? []), value];
  }

  return expandRawEvents(rawEvents, recurrenceWindow);
}

function rawEventFromProperties(current: Record<string, string[]>): RawIcsEvent | null {
  const dtstart = firstProperty(current, "DTSTART");
  const summary = firstProperty(current, "SUMMARY");
  if (!dtstart || !summary) return null;

  const start = parseIcsDate(dtstart);
  if (!start) return null;

  const dtend = firstProperty(current, "DTEND");
  const end = dtend ? parseIcsDate(dtend) ?? undefined : undefined;
  const recurrenceId = firstProperty(current, "RECURRENCE-ID");
  const description = firstProperty(current, "DESCRIPTION")
    ? cleanCalendarDescription(decodeIcsText(firstProperty(current, "DESCRIPTION") ?? ""))
    : undefined;

  return {
    uid: firstProperty(current, "UID") ?? `${summary}-${dtstart}`,
    title: decodeIcsText(summary),
    description,
    location: firstProperty(current, "LOCATION")
      ? decodeIcsText(firstProperty(current, "LOCATION") ?? "")
      : undefined,
    start,
    end,
    allDay: dtstart.length === 8,
    rrule: firstProperty(current, "RRULE"),
    exdates: allProperties(current, "EXDATE").flatMap(parseIcsDateList),
    recurrenceId: recurrenceId ? parseIcsDate(recurrenceId) ?? undefined : undefined,
  };
}

function expandRawEvents(rawEvents: RawIcsEvent[], recurrenceWindow?: CalendarWindow): CalendarEvent[] {
  const overrides = rawEvents.filter((event) => event.recurrenceId);
  const overrideKeys = new Set(
    overrides.map((event) => `${event.uid}:${event.recurrenceId?.getTime()}`),
  );
  const events: CalendarEvent[] = [];

  for (const event of rawEvents) {
    if (event.recurrenceId) {
      events.push(toCalendarEvent(event));
      continue;
    }

    if (!event.rrule || !recurrenceWindow) {
      events.push(toCalendarEvent(event));
      continue;
    }

    for (const occurrence of expandRecurringEvent(event, recurrenceWindow)) {
      if (overrideKeys.has(`${event.uid}:${occurrence.start.getTime()}`)) continue;
      events.push(toCalendarEvent(occurrence));
    }
  }

  return events;
}

function expandRecurringEvent(event: RawIcsEvent, window: CalendarWindow): RawIcsEvent[] {
  const rule = parseRrule(event.rrule ?? "");
  const until = rule.UNTIL ? parseIcsDate(rule.UNTIL) : null;
  const effectiveEnd = until && until < window.end ? until : window.end;

  if (effectiveEnd < event.start) return [];

  if (rule.FREQ === "WEEKLY") {
    return expandWeeklyEvent(event, window.start, effectiveEnd, rule);
  }

  if (rule.FREQ === "MONTHLY") {
    return expandMonthlyEvent(event, window.start, effectiveEnd, rule);
  }

  return [];
}

function expandWeeklyEvent(
  event: RawIcsEvent,
  windowStart: Date,
  windowEnd: Date,
  rule: Record<string, string>,
): RawIcsEvent[] {
  const interval = parsePositiveInt(rule.INTERVAL) ?? 1;
  const byDays = (rule.BYDAY?.split(",") ?? [weekdayCode(event.start)]).map(parseByDay);
  const duration = eventDurationMs(event);
  const occurrences: RawIcsEvent[] = [];
  const cursor = startOfLocalDay(event.start);

  while (cursor <= windowEnd) {
    const weeksSinceStart = Math.floor((startOfLocalDay(cursor).getTime() - startOfLocalDay(event.start).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const repeatsThisWeek = weeksSinceStart >= 0 && weeksSinceStart % interval === 0;

    if (repeatsThisWeek && byDays.some((byDay) => byDay.weekday === weekdayCode(cursor))) {
      const occurrenceStart = withTimeFrom(cursor, event.start);
      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
      if (
        occurrenceEnd >= windowStart &&
        occurrenceStart <= windowEnd &&
        !isExcludedOccurrence(event, occurrenceStart)
      ) {
        occurrences.push(cloneOccurrence(event, occurrenceStart, occurrenceEnd));
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences;
}

function expandMonthlyEvent(
  event: RawIcsEvent,
  windowStart: Date,
  windowEnd: Date,
  rule: Record<string, string>,
): RawIcsEvent[] {
  const interval = parsePositiveInt(rule.INTERVAL) ?? 1;
  const byDays = (rule.BYDAY?.split(",") ?? [`${monthlyOrdinal(event.start)}${weekdayCode(event.start)}`]).map(parseByDay);
  const duration = eventDurationMs(event);
  const occurrences: RawIcsEvent[] = [];
  const cursor = new Date(event.start.getFullYear(), event.start.getMonth(), 1);

  while (cursor <= windowEnd) {
    const monthsSinceStart =
      (cursor.getFullYear() - event.start.getFullYear()) * 12 +
      (cursor.getMonth() - event.start.getMonth());
    const repeatsThisMonth = monthsSinceStart >= 0 && monthsSinceStart % interval === 0;

    if (repeatsThisMonth) {
      for (const byDay of byDays) {
        const occurrenceDate = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), byDay.weekday, byDay.ordinal);
        if (!occurrenceDate) continue;

        const occurrenceStart = withTimeFrom(occurrenceDate, event.start);
        const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
        if (
          occurrenceStart >= event.start &&
          occurrenceEnd >= windowStart &&
          occurrenceStart <= windowEnd &&
          !isExcludedOccurrence(event, occurrenceStart)
        ) {
          occurrences.push(cloneOccurrence(event, occurrenceStart, occurrenceEnd));
        }
      }
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return occurrences;
}

function toCalendarEvent(event: RawIcsEvent): CalendarEvent {
  return {
    uid: event.recurrenceId ? `${event.uid}-${event.recurrenceId.toISOString()}` : event.uid,
    title: event.title,
    description: event.description,
    location: event.location,
    start: event.start.toISOString(),
    end: event.end?.toISOString(),
    allDay: event.allDay,
  };
}

function firstProperty(properties: Record<string, string[]>, key: string): string | undefined {
  return properties[key]?.[0];
}

function allProperties(properties: Record<string, string[]>, key: string): string[] {
  return properties[key] ?? [];
}

function parseIcsDateList(value: string): Date[] {
  return value.split(",").flatMap((dateValue) => {
    const date = parseIcsDate(dateValue);
    return date ? [date] : [];
  });
}

function parseRrule(rrule: string): Record<string, string> {
  return Object.fromEntries(
    rrule.split(";").map((part) => {
      const [key, value = ""] = part.split("=");
      return [key, value];
    }),
  );
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseByDay(value: string): { ordinal: number | null; weekday: string } {
  const match = value.match(/^([+-]?\d+)?([A-Z]{2})$/);
  return {
    ordinal: match?.[1] ? Number.parseInt(match[1], 10) : null,
    weekday: match?.[2] ?? value,
  };
}

function weekdayCode(date: Date): string {
  return ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][date.getDay()];
}

function monthlyOrdinal(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: string, ordinal: number | null): Date | null {
  const weekdayIndex = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(weekday);
  if (weekdayIndex === -1) return null;

  if ((ordinal ?? 0) < 0) {
    const date = new Date(year, month + 1, 0);
    while (date.getDay() !== weekdayIndex) date.setDate(date.getDate() - 1);
    date.setDate(date.getDate() - (Math.abs(ordinal ?? -1) - 1) * 7);
    return date.getMonth() === month ? date : null;
  }

  const nth = ordinal ?? 1;
  const date = new Date(year, month, 1);
  while (date.getDay() !== weekdayIndex) date.setDate(date.getDate() + 1);
  date.setDate(date.getDate() + (nth - 1) * 7);
  return date.getMonth() === month ? date : null;
}

function eventDurationMs(event: RawIcsEvent): number {
  return event.end ? event.end.getTime() - event.start.getTime() : 0;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function withTimeFrom(date: Date, timeSource: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds(),
  );
}

function isExcludedOccurrence(event: RawIcsEvent, occurrenceStart: Date): boolean {
  return event.exdates.some((exdate) => exdate.getTime() === occurrenceStart.getTime());
}

function cloneOccurrence(event: RawIcsEvent, start: Date, end?: Date): RawIcsEvent {
  return {
    ...event,
    start,
    end,
    recurrenceId: start,
    rrule: undefined,
    exdates: [],
  };
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

function cleanCalendarDescription(value: string): string | undefined {
  const cleaned = value
    .replace(/Join with Google Meet:\s*https:\/\/meet\.google\.com\/[^\s]+/gi, "")
    .replace(/Learn more about Meet at:\s*https:\/\/support\.google\.com\/[^\s]+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned || undefined;
}
