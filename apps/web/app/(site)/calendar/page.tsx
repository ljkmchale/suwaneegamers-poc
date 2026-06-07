import type { Metadata } from "next";
import Image from "next/image";
import {
  type CalendarEvent,
  fetchUpcomingCalendarEvents,
  googleCalendarEmbedUrl,
  GOOGLE_CALENDAR_TIMEZONE,
} from "@/lib/calendar";
import {
  findCampaignForCalendarEvent,
  getActiveCampaigns,
  normalizeCampaignTitle,
} from "@/lib/campaigns";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Suwanee Gamers Calendar for upcoming DND sessions and table events.",
};

// Revalidate every 5 minutes to stay current with the Google Calendar feed.
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

function eventTimeLabel(event: CalendarEvent): string {
  if (event.allDay) return "All day";

  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;

  return end
    ? `${timeFormatter.format(start)}-${timeFormatter.format(end)}`
    : timeFormatter.format(start);
}

export default async function CalendarPage() {
  let events: CalendarEvent[] = [];
  let feedError = false;
  const campaigns = getActiveCampaigns();

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

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <header className="mb-10 text-center">
          <h1 className="font-cinzel mb-4 text-4xl uppercase tracking-widest shimmer-text">
            Events
          </h1>
          <p
            className="mx-auto max-w-2xl"
            style={{
              color: "#f3ead7",
              textShadow: "0 2px 18px rgba(0,0,0,0.75)",
            }}
          >
            Shared Suwanee Gamers schedule.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <section className="fantasy-card overflow-hidden">
            <div
              className="border-b px-6 py-5"
              style={{ borderColor: "var(--color-bg-border)" }}
            >
              <p
                className="font-cinzel text-xs uppercase tracking-[0.35em]"
                style={{ color: "var(--color-accent-arcane)" }}
              >
                Live Schedule
              </p>
              <h2
                className="font-cinzel mt-1 text-2xl"
                style={{ color: "var(--color-accent-gold)" }}
              >
                Upcoming Table Events
              </h2>
            </div>

            <div className="p-5 sm:p-6">
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

              <div className="grid gap-4">
                {events.map((event) => {
                  const start = new Date(event.start);
                  const campaign = findCampaignForCalendarEvent(event, campaigns);
                  const image = campaign?.headerImage;
                  const showCampaignLabel =
                    campaign &&
                    normalizeCampaignTitle(event.title) !== normalizeCampaignTitle(campaign.name);

                  return (
                    <article
                      key={event.uid}
                      className={
                        image
                          ? "grid overflow-hidden rounded-lg border sm:grid-cols-[13rem_1fr]"
                          : "grid gap-4 rounded-lg border p-4 sm:grid-cols-[8rem_1fr]"
                      }
                      style={{
                        borderColor: "var(--color-bg-border)",
                        background:
                          "linear-gradient(135deg, rgba(15,10,26,.82), rgba(8,5,15,.72))",
                        boxShadow: "0 14px 38px rgba(0,0,0,.28)",
                      }}
                    >
                      {image ? (
                        <div className="relative min-h-40 sm:min-h-full">
                          <Image
                            src={image}
                            alt={campaign?.name ? `${campaign.name} campaign art` : ""}
                            fill
                            sizes="(min-width: 640px) 13rem, 100vw"
                            className="object-cover"
                            style={{ objectPosition: campaign?.headerImagePosition ?? "center" }}
                          />
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(8,5,15,.04), rgba(8,5,15,.34))",
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          className="rounded-md border px-3 py-3 text-center"
                          style={{
                            borderColor: "rgba(245,158,11,.34)",
                            background: "rgba(245,158,11,.08)",
                          }}
                        >
                          <p
                            className="font-cinzel text-sm leading-tight"
                            style={{ color: "var(--color-accent-gold)" }}
                          >
                            {dateFormatter.format(start)}
                          </p>
                          <p
                            className="mt-2 text-xs"
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            {eventTimeLabel(event)}
                          </p>
                        </div>
                      )}

                      <div className={image ? "min-w-0 p-5" : "min-w-0"}>
                        {image && (
                          <p
                            className="font-cinzel mb-2 text-xs uppercase tracking-[0.24em]"
                            style={{ color: "var(--color-accent-arcane)" }}
                          >
                            {dateFormatter.format(start)} - {eventTimeLabel(event)}
                          </p>
                        )}
                        <h3
                          className="font-cinzel text-lg leading-snug"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {event.title}
                        </h3>
                        {showCampaignLabel && (
                          <p
                            className="mt-1 font-cinzel text-xs uppercase tracking-[0.24em]"
                            style={{ color: "var(--color-accent-gold)" }}
                          >
                            {campaign.name}
                          </p>
                        )}
                        {event.location && (
                          <p
                            className="mt-2 text-sm"
                            style={{ color: "var(--color-accent-arcane)" }}
                          >
                            {event.location}
                          </p>
                        )}
                        {event.description && (
                          <p
                            className="mt-3 line-clamp-2 text-sm"
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            {event.description}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="fantasy-card overflow-hidden">
              <div className="p-5">
                <h2
                  className="font-cinzel text-lg"
                  style={{ color: "var(--color-accent-gold)" }}
                >
                  Google Calendar
                </h2>
                <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Full shared calendar view.
                </p>
              </div>
              <div
                className="border-t p-3"
                style={{
                  borderColor: "var(--color-bg-border)",
                  background: "rgba(8,5,15,.72)",
                }}
              >
                <iframe
                  title="Suwanee Gamers Event Calendar"
                  src={googleCalendarEmbedUrl()}
                  className="w-full rounded-md"
                  style={{ height: "520px", border: 0, background: "#fff" }}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
