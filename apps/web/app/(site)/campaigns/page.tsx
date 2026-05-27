import Link from "next/link";
import type { Metadata } from "next";
import { fetchUpcomingCalendarEvents, GOOGLE_CALENDAR_TIMEZONE } from "@/lib/calendar";
import { findNextCampaignEvent, listedCampaigns, sideCampaigns } from "@/lib/campaigns";
import { getPageLayout } from "@/lib/pageLayouts";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { PageItem } from "@/lib/pageBlocks";

export const metadata: Metadata = {
  title: "Campaigns",
  description: "Active Suwanee Gamers campaigns, Dungeon Masters, schedules, and next session dates.",
};

export const revalidate = 300;

// ── Formatters ────────────────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short", month: "short", day: "numeric",
  timeZone: GOOGLE_CALENDAR_TIMEZONE,
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric", minute: "2-digit",
  timeZone: GOOGLE_CALENDAR_TIMEZONE,
});

function formatEventDate(event: ReturnType<typeof findNextCampaignEvent>) {
  if (!event) return null;
  const start = new Date(event.start);
  return event.allDay
    ? dateFormatter.format(start)
    : `${dateFormatter.format(start)} at ${timeFormatter.format(start)}`;
}

// ── Sections ──────────────────────────────────────────────────────────────────

type Campaign = ReturnType<typeof listedCampaigns>[number];
type CalendarEvent = Awaited<ReturnType<typeof fetchUpcomingCalendarEvents>>[number];

function HeaderSection() {
  return (
    <header className="mb-14 text-center">
      <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3"
        style={{ color: "var(--color-accent-arcane)" }}>
        Now Playing
      </p>
      <h1 className="font-cinzel text-4xl tracking-widest uppercase mb-4 shimmer-text">
        Active Campaigns
      </h1>
      <p className="max-w-2xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
        Current Suwanee Gamers campaigns, matching the legacy campaign index: title, cadence, and DM.
      </p>
    </header>
  );
}

function CampaignsSection({ listed, events }: { listed: Campaign[]; events: CalendarEvent[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {listed.map((campaign) => {
        const nextEvent = findNextCampaignEvent(campaign, events);
        const nextDate = formatEventDate(nextEvent);

        return (
          <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="fantasy-card block group overflow-hidden">
            {campaign.headerImage && (
              <div className="h-36 border-b" style={{
                backgroundImage: `linear-gradient(to bottom, rgba(8, 5, 15, 0.08), rgba(8, 5, 15, 0.62)), url("${campaign.headerImage}")`,
                backgroundPosition: campaign.headerImagePosition ?? "center",
                backgroundSize: "cover",
                borderColor: "var(--color-bg-border)",
              }} />
            )}
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-cinzel text-2xl leading-tight group-hover:text-amber-400 transition-colors"
                    style={{ color: "var(--color-text-primary)" }}>
                    {campaign.name}
                  </h2>
                </div>
                <span className="shrink-0 text-xs font-cinzel tracking-widest uppercase px-2.5 py-1 rounded-full border"
                  style={{ color: "var(--color-accent-arcane)", borderColor: "var(--color-accent-arcane)" }}>
                  Active
                </span>
              </div>
              <div className="space-y-4 pt-4 border-t text-sm" style={{ borderColor: "var(--color-bg-border)" }}>
                <div>
                  <p className="font-cinzel tracking-widest uppercase mb-1" style={{ color: "var(--color-text-muted)" }}>
                    {campaign.schedule}
                  </p>
                  <p style={{ color: "var(--color-accent-gold)" }}>DM: {campaign.dm}</p>
                </div>
                <div>
                  <p className="font-cinzel tracking-widest uppercase mb-1" style={{ color: "var(--color-text-muted)" }}>
                    Next Date
                  </p>
                  <p style={{ color: nextDate ? "var(--color-accent-gold)" : "var(--color-text-secondary)" }}>
                    {nextDate ?? "See calendar"}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function SideCampaignsSection({ side }: { side: Campaign[] }) {
  if (side.length === 0) return null;
  return (
    <section className="mt-10">
      <p className="font-cinzel text-xs tracking-[0.35em] uppercase mb-4"
        style={{ color: "var(--color-text-muted)" }}>
        Other Campaign Tools
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {side.map((campaign) => (
          <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="fantasy-card block group overflow-hidden">
            {campaign.headerImage && (
              <div className="h-32 border-b" style={{
                backgroundImage: `linear-gradient(to bottom, rgba(8, 5, 15, 0.08), rgba(8, 5, 15, 0.62)), url("${campaign.headerImage}")`,
                backgroundPosition: campaign.headerImagePosition ?? "center",
                backgroundSize: "cover",
                borderColor: "var(--color-bg-border)",
              }} />
            )}
            <div className="p-6">
              <h2 className="font-cinzel text-xl leading-tight group-hover:text-amber-400 transition-colors mb-2"
                style={{ color: "var(--color-text-primary)" }}>
                {campaign.name}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {campaign.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CampaignsPage() {
  const events = await fetchUpcomingCalendarEvents(50).catch(() => []);
  const listed = listedCampaigns();
  const side = sideCampaigns();
  const order = getPageLayout("/campaigns");

  const sectionMap: Record<string, React.ReactNode> = {
    "header":         <HeaderSection key="header" />,
    "campaigns":      <CampaignsSection key="campaigns" listed={listed} events={events} />,
    "side-campaigns": <SideCampaignsSection key="side-campaigns" side={side} />,
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      {order.map((item: PageItem) =>
        item.kind === "section"
          ? <div key={item.id} data-section-id={item.id}>{sectionMap[item.id] ?? null}</div>
          : <BlockRenderer key={item.id} block={item} />
      )}
    </div>
  );
}
