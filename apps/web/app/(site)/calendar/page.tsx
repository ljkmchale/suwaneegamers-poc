import type { Metadata } from "next";
import Image from "next/image";
import {
  type CalendarEvent,
  fetchRecentCalendarEvents,
  fetchUpcomingCalendarEvents,
  googleCalendarEmbedUrl,
  GOOGLE_CALENDAR_TIMEZONE,
} from "@/lib/calendar";
import {
  getActiveCampaigns,
  findCampaignForCalendarEvent,
  findPreviousCampaignEvent,
  normalizeCampaignTitle,
  type PortalCampaign,
} from "@/lib/campaigns";
import { getTrackedActiveCampaigns } from "@/lib/campaignTracking";
import { getCampaignsWithDocumentSessionSummaries } from "@/lib/sessionSummaries";
import { AdventureFoldCard } from "./AdventureFoldCard";
import { LogoLightning } from "./LogoLightning";
import { RunicBackground } from "./RunicBackground";

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

const calendarDayFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: GOOGLE_CALENDAR_TIMEZONE,
});

// For plain YYYY-MM-DD session dates (no time component, already local).
const localDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function eventTimeLabel(event: CalendarEvent): string {
  if (event.allDay) return "All day";

  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;

  return end
    ? `${timeFormatter.format(start)}-${timeFormatter.format(end)}`
    : timeFormatter.format(start);
}

function calendarDayKey(date: Date): string {
  return calendarDayFormatter.format(date);
}

function isEventToday(event: CalendarEvent, today = new Date()): boolean {
  return calendarDayKey(new Date(event.start)) === calendarDayKey(today);
}

function formatSessionDate(value: string): string {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return localDateFormatter.format(
      new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    );
  }
  return dateFormatter.format(new Date(value));
}

interface LatestAdventure {
  key: string;
  campaignId: string;
  campaignName: string;
  headerImage?: string;
  headerImagePosition?: string;
  sessionNumber?: number;
  sessionTitle: string;
  sessionDate: string;
  sortDate: number;
  summary?: string;
  audioUrl?: string;
}

function splitSessionTitle(title: string): { number?: number; text: string } {
  const match = title.match(/^(?:session\s*)?(\d+)\s*[-–—:\s]+\s*(.+)$/i);
  if (match) {
    return { number: Number.parseInt(match[1], 10), text: match[2].trim() };
  }
  return { text: title };
}

function sessionSortDate(value: string): number {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    ).getTime();
  }
  return new Date(value).getTime();
}

function visibleCampaigns(campaigns: PortalCampaign[]) {
  return campaigns.filter((campaign) => campaign.official !== false);
}

function latestAdventures(
  campaigns: PortalCampaign[],
  pastEvents: CalendarEvent[],
  limit = 6,
): LatestAdventure[] {
  const adventures: LatestAdventure[] = [];

  for (const campaign of visibleCampaigns(campaigns)) {
    const notes = campaign.sessionSummaries ?? [];

    // Only the most recent session per campaign — notes[0] is newest.
    for (let index = 0; index < notes.length; index++) {
      const note = notes[index];
      const date =
        note.sessionDate ??
        (index === 0 ? findPreviousCampaignEvent(campaign, pastEvents)?.start : undefined);
      if (!date) continue;

      const { number, text } = splitSessionTitle(note.title);
      adventures.push({
        key: `${campaign.id}-${note.title}`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        headerImage: campaign.headerImage,
        headerImagePosition: campaign.headerImagePosition,
        sessionNumber: number,
        sessionTitle: text,
        sessionDate: date,
        sortDate: sessionSortDate(date),
        summary: note.summary,
        audioUrl: note.audioLinks?.[0]?.url,
      });
      break; // one entry per campaign
    }
  }

  return adventures.sort((a, b) => b.sortDate - a.sortDate).slice(0, limit);
}

export default async function CalendarPage() {
  let events: CalendarEvent[] = [];
  let pastEvents: CalendarEvent[] = [];
  let feedError = false;
  const campaigns = await getCampaignsWithDocumentSessionSummaries(
    await getTrackedActiveCampaigns(getActiveCampaigns()),
  );

  try {
    events = await fetchUpcomingCalendarEvents(6);
  } catch {
    feedError = true;
  }

  try {
    pastEvents = await fetchRecentCalendarEvents();
  } catch {
    // Latest adventures still render from stored session dates.
  }

  const adventures = latestAdventures(campaigns, pastEvents, 6);

  return (
    <div className="relative min-h-screen">
      <RunicBackground />

      <div className="relative z-10 mx-auto max-w-[100rem] px-6 py-20">
        <header className="mb-14 flex flex-col items-center text-center">
          <LogoLightning
            src="/images/suwaneegamers-logo-v18-4800p.png"
            alt="Suwanee Gamers"
            width={220}
            height={220}
            className="mb-6 drop-shadow-[0_0_32px_rgba(139,92,246,0.35)]"
            priority
          />
          <h1 className="font-cinzel mb-4 text-5xl uppercase tracking-widest shimmer-text">
            Suwanee Gamers
          </h1>
          <p
            className="max-w-2xl text-base italic leading-relaxed"
            style={{
              color: "var(--color-text-secondary)",
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}
          >
            &ldquo;Many campaigns. Five Dungeon Masters. One living world. Welcome to Myrdae in the era of The Awakening — where the old gods have gone silent and the world holds its breath while welcoming the new gods.&rdquo;
          </p>
        </header>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr_3fr]">
          <section>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
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
                  Upcoming Adventures
                </h2>
              </div>
              <a
                href={googleCalendarEmbedUrl()}
                target="_blank"
                rel="noopener noreferrer"
                title="Open the full Google Calendar"
                aria-label="Open the full Google Calendar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors hover:opacity-80"
                style={{
                  borderColor: "rgba(245,158,11,.34)",
                  background: "rgba(245,158,11,.08)",
                  color: "var(--color-accent-gold)",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </a>
            </div>

            {feedError && (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                The public event feed could not be read. Use the calendar icon to open the full Google Calendar.
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
                const today = isEventToday(event);

                return (
                  <article
                    key={event.uid}
                    className={
                      image
                        ? "relative grid overflow-hidden rounded-lg border sm:grid-cols-[13rem_1fr]"
                        : "relative grid gap-4 rounded-lg border p-4 sm:grid-cols-[8rem_1fr]"
                    }
                    style={{
                      borderColor: "var(--color-bg-border)",
                      background:
                        "linear-gradient(135deg, rgba(15,10,26,.82), rgba(8,5,15,.72))",
                      boxShadow: "0 14px 38px rgba(0,0,0,.28)",
                    }}
                  >
                    {today && (
                      <span
                        className="absolute right-3 top-3 z-10 rounded-full border px-3 py-1 font-cinzel text-[0.65rem] uppercase tracking-[0.2em]"
                        style={{
                          background: "rgba(245,158,11,.18)",
                          borderColor: "rgba(245,158,11,.55)",
                          color: "var(--color-accent-gold)",
                          boxShadow: "0 0 18px rgba(245,158,11,.22)",
                        }}
                      >
                        Today
                      </span>
                    )}
                    {image ? (
                      <div className="relative min-h-28 sm:min-h-full">
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

                    <div className={image ? "flex min-w-0 flex-col justify-center p-5" : "min-w-0"}>
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
                        {campaign?.name ?? event.title}
                        {campaign?.dm && (
                          <span
                            className="ml-2 inline-block text-sm"
                            style={{ color: "var(--color-accent-gold)" }}
                          >
                            - DM: {campaign.dm}
                          </span>
                        )}
                      </h3>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section
            className="lg:border-l lg:pl-10"
            style={{ borderColor: "var(--color-bg-border)" }}
          >
            <div className="mb-5">
              <p
                className="font-cinzel text-xs uppercase tracking-[0.35em]"
                style={{ color: "var(--color-accent-arcane)" }}
              >
                Session Notes
              </p>
              <h2
                className="font-cinzel mt-1 text-2xl"
                style={{ color: "var(--color-accent-gold)" }}
              >
                Previous Adventures
              </h2>
            </div>

            {adventures.length === 0 && (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                No session notes have been recorded yet.
              </p>
            )}

            <div className="grid gap-4">
              {adventures.map((adventure) => (
                <AdventureFoldCard
                  key={adventure.key}
                  campaignId={adventure.campaignId}
                  campaignName={adventure.campaignName}
                  headerImage={adventure.headerImage}
                  headerImagePosition={adventure.headerImagePosition}
                  dateLabel={formatSessionDate(adventure.sessionDate)}
                  sessionNumber={adventure.sessionNumber}
                  sessionTitle={adventure.sessionTitle}
                  summary={adventure.summary}
                  audioUrl={adventure.audioUrl}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
