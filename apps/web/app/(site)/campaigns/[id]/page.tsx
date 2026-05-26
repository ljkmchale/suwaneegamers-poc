import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchUpcomingCalendarEvents, GOOGLE_CALENDAR_TIMEZONE } from "@/lib/calendar";
import {
  activeCampaigns,
  fetchLegacyCampaignSessionSummaries,
  findCampaign,
  findNextCampaignEvent,
} from "@/lib/campaigns";

interface Props {
  params: Promise<{ id: string }>;
}

export const revalidate = 300;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: GOOGLE_CALENDAR_TIMEZONE,
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: GOOGLE_CALENDAR_TIMEZONE,
});

export function generateStaticParams() {
  return activeCampaigns.map((campaign) => ({ id: campaign.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const campaign = findCampaign(id);
  return {
    title: campaign?.name ?? "Campaign",
    description: campaign?.description ?? "Suwanee Gamers campaign portal page.",
  };
}

function formatEventDate(event: ReturnType<typeof findNextCampaignEvent>) {
  if (!event) return "See the shared calendar";
  const start = new Date(event.start);
  return event.allDay
    ? dateFormatter.format(start)
    : `${dateFormatter.format(start)} at ${timeFormatter.format(start)}`;
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const campaign = findCampaign(id);

  if (!campaign) notFound();

  const events = await fetchUpcomingCalendarEvents(50).catch(() => []);
  const nextEvent = findNextCampaignEvent(campaign, events);
  const sessionSummaries = await fetchLegacyCampaignSessionSummaries(campaign);

  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
      <Link
        href="/campaigns"
        className="text-xs font-cinzel tracking-widest uppercase transition-opacity hover:opacity-80"
        style={{ color: "var(--color-text-muted)" }}
      >
        ← Campaigns
      </Link>

      <article className="mt-8">
        <section
          className="relative min-h-72 overflow-hidden rounded-lg border mb-6 flex items-end"
          style={{
            backgroundImage: campaign.headerImage
              ? `linear-gradient(to bottom, rgba(8, 5, 15, 0.12), rgba(8, 5, 15, 0.86)), url("${campaign.headerImage}")`
              : "linear-gradient(135deg, rgba(22, 22, 30, 0.9), rgba(15, 10, 26, 0.95))",
            backgroundPosition: campaign.headerImagePosition ?? "center",
            backgroundSize: "cover",
            borderColor: "var(--color-bg-border)",
          }}
        >
          <div className="p-6 md:p-8">
            <p
              className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              Campaign
            </p>
            <h1 className="font-cinzel text-4xl tracking-widest uppercase shimmer-text">
              {campaign.name}
            </h1>
          </div>
        </section>

        <div className="fantasy-card p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="font-cinzel text-xs tracking-widest uppercase mb-2" style={{ color: "var(--color-text-muted)" }}>
                Schedule
              </p>
              <p style={{ color: "var(--color-text-secondary)" }}>{campaign.schedule}</p>
            </div>
            <div>
              <p className="font-cinzel text-xs tracking-widest uppercase mb-2" style={{ color: "var(--color-text-muted)" }}>
                Dungeon Master
              </p>
              <p style={{ color: "var(--color-accent-gold)" }}>{campaign.dm}</p>
            </div>
            <div>
              <p className="font-cinzel text-xs tracking-widest uppercase mb-2" style={{ color: "var(--color-text-muted)" }}>
                Next Session
              </p>
              <p style={{ color: "var(--color-accent-gold)" }}>{formatEventDate(nextEvent)}</p>
            </div>
          </div>
        </div>

        <section className="fantasy-card p-6 mb-6">
          <div className="flex flex-wrap gap-3">
            {(campaign.resources ?? []).map((resource) => (
              <a
                key={resource.url}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-md border font-cinzel text-xs tracking-widest uppercase transition-colors hover:border-amber-400"
                style={{ borderColor: "var(--color-bg-border)", color: "var(--color-accent-gold)" }}
              >
                {resource.label}
              </a>
            ))}
            <a
              href={campaign.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-md border font-cinzel text-xs tracking-widest uppercase transition-colors hover:border-amber-400"
              style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-secondary)" }}
            >
              Legacy Page
            </a>
          </div>
        </section>

        <section className="fantasy-card p-6 mb-6">
          <h2 className="font-cinzel text-xl tracking-widest uppercase mb-4" style={{ color: "var(--color-text-primary)" }}>
            Notes
          </h2>
          <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--color-text-secondary)" }}>
            {campaign.description}
          </p>
          {campaign.party && campaign.party.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {campaign.party.map((member) => (
                member.url ? (
                  <a
                    key={member.name}
                    href={member.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border px-3 py-2 text-sm transition-colors hover:border-amber-400"
                    style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-secondary)" }}
                  >
                    <span className="block">{member.name}</span>
                    {member.player && (
                      <span className="mt-1 block text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {member.player}
                      </span>
                    )}
                  </a>
                ) : (
                  <span
                    key={member.name}
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-muted)" }}
                  >
                    <span className="block">{member.name}</span>
                    {member.player && (
                      <span className="mt-1 block text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {member.player}
                      </span>
                    )}
                  </span>
                )
              ))}
            </div>
          )}
        </section>

        {sessionSummaries.length > 0 && (
          <section className="fantasy-card p-6 mb-6">
            <h2
              className="font-cinzel text-xl tracking-widest uppercase mb-5"
              style={{ color: "var(--color-text-primary)" }}
            >
              Session Summaries
            </h2>
            <div className="space-y-6">
              {sessionSummaries.map((session) => (
                <article key={session.title}>
                  <h3 className="font-cinzel text-lg mb-2" style={{ color: "var(--color-accent-gold)" }}>
                    {session.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                    {session.summary}
                  </p>
                  {session.audioLinks && session.audioLinks.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {session.audioLinks.map((audioLink) => (
                        <a
                          key={audioLink.url}
                          href={audioLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${audioLink.label} for ${session.title}`}
                          title={audioLink.label}
                          className="inline-flex h-14 w-14 items-center justify-center rounded-full border bg-black/20 p-1.5 shadow-lg transition-all hover:scale-105 hover:border-amber-400"
                          style={{
                            borderColor: "var(--color-bg-border)",
                            boxShadow: "0 0 18px rgba(245, 158, 11, 0.14)",
                          }}
                        >
                          <Image
                            src="/images/dragon-ears.png"
                            alt=""
                            width={44}
                            height={44}
                            className="h-full w-full rounded-full object-contain"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
