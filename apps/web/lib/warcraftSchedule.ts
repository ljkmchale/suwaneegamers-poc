import { GOOGLE_CALENDAR_TIMEZONE, type CalendarEvent } from "./calendar";

export function warcraftCalendarNights(events: CalendarEvent[], now = new Date()): CalendarEvent[] {
  return events.filter(event => /\b(?:world\s+of\s+warcraft|wow)\b/i.test(event.title)
    && new Date(event.end ?? event.start).getTime() >= now.getTime()
    && Number.isFinite(new Date(event.start).getTime()))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function warcraftNightDate(event: CalendarEvent): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: GOOGLE_CALENDAR_TIMEZONE, weekday: "long", month: "short", day: "numeric" }).format(new Date(event.start));
}

export function warcraftNightTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const time = new Intl.DateTimeFormat("en-US", { timeZone: GOOGLE_CALENDAR_TIMEZONE, hour: "numeric", minute: "2-digit" });
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: GOOGLE_CALENDAR_TIMEZONE, timeZoneName: "short" }).formatToParts(new Date(event.start)).find(part => part.type === "timeZoneName")?.value;
  return `${time.format(new Date(event.start))}${event.end ? ` – ${time.format(new Date(event.end))}` : ""} ${zone ?? ""}`.trim();
}
