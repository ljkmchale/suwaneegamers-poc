import type { Metadata } from "next";
import {
  type CalendarEvent,
  fetchUpcomingCalendarEvents,
  googleCalendarEmbedUrl,
  GOOGLE_CALENDAR_TIMEZONE,
} from "@/lib/calendar";

export const metadata: Metadata = {
  title: "Calendar",
  description:
    "Suwanee Gamers shared Google Calendar for upcoming DND sessions and table events.",
};

// Revalidate every 5 minutes to stay current with the Google Calendar feed
export const revalidate = 300;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: GOOGLE_CALENDAR_TIMEZONE,
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: GOOGLE_CALENDAR_TIMEZONE,
});

export default async function CalendarPage() {
  let events: CalendarEvent[] = [];
  let feedError = false;

  try {
    events = await fetchUpcomingCalendarEvents(8);
  } catch {
    feedError = true;
  }

  return (
    <div
      className="art-bg-silver relative min-h-screen overflow-hidden bg-[#07101d]"
      style={{
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-black/45" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.78) 0%, rgba(8,5,15,0.38) 36%, rgba(8,5,15,0.92) 100%)",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <header className="mb-10 text-center">
          <h1 className="font-cinzel text-4xl tracking-widest uppercase mb-4 shimmer-text">
            Calendar
          </h1>
          <p className="max-w-2xl mx-auto" style={{ color: "#f3ead7", textShadow: "0 2px 18px rgba(0,0,0,0.75)" }}>
            Shared Suwanee Gamers schedule, read directly from Google Calendar.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <section className="fantasy-card overflow-hidden">
            <iframe
              title="Suwanee Gamers Google Calendar"
              src={googleCalendarEmbedUrl()}
              className="w-full"
              style={{ height: "min(78vh, 760px)", border: 0, background: "#fff" }}
            />
          </section>

          <aside className="space-y-4">
            <div className="fantasy-card p-5">
              <h2
                className="font-cinzel text-lg mb-4"
                style={{ color: "var(--color-accent-gold)" }}
              >
                Upcoming Events
              </h2>

              {feedError && (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  The embedded calendar is available, but the public event feed could not be read.
                </p>
              )}

              {!feedError && events.length === 0 && (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  No upcoming events are currently visible in the public feed.
                </p>
              )}

              <div className="space-y-4">
                {events.map((event) => {
                  const start = new Date(event.start);
                  const end = event.end ? new Date(event.end) : null;

                  return (
                    <article
                      key={event.uid}
                      className="border-b pb-4 last:border-b-0 last:pb-0"
                      style={{ borderColor: "var(--color-bg-border)" }}
                    >
                      <p
                        className="font-cinzel text-sm leading-snug mb-1"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {event.title}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-accent-arcane)" }}>
                        {dateFormatter.format(start)}
                        {!event.allDay && ` · ${timeFormatter.format(start)}`}
                        {!event.allDay && end && `-${timeFormatter.format(end)}`}
                      </p>
                      {event.location && (
                        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                          {event.location}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
