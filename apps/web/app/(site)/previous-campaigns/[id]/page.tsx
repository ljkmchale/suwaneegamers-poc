import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findArchivedCampaign, getArchivedCampaigns } from "@/lib/archivedCampaigns";

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return getArchivedCampaigns().map((campaign) => ({ id: campaign.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const campaign = findArchivedCampaign(id);
  return {
    title: campaign?.name ?? "Previous Campaign",
    description: campaign?.description ?? "Suwanee Gamers previous campaign archive.",
  };
}

export default async function ArchivedCampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const campaign = findArchivedCampaign(id);
  if (!campaign) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
      <Link
        href="/previous-campaigns"
        className="text-xs font-cinzel tracking-widest uppercase transition-opacity hover:opacity-80"
        style={{ color: "var(--color-text-muted)" }}
      >
        &larr; Previous Campaigns
      </Link>

      <article className="mt-8">
        <section
          className="relative min-h-72 overflow-hidden rounded-lg border mb-6 flex items-end"
          style={{
            backgroundImage: campaign.headerImage
              ? `linear-gradient(to bottom, rgba(8, 5, 15, 0.12), rgba(8, 5, 15, 0.86)), url("${campaign.headerImage}")`
              : "linear-gradient(135deg, rgba(22, 22, 30, 0.9), rgba(15, 10, 26, 0.95))",
            backgroundPosition: "center",
            backgroundSize: "cover",
            borderColor: "var(--color-bg-border)",
          }}
        >
          <div className="p-6 md:p-8">
            <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3" style={{ color: "var(--color-accent-arcane)" }}>
              Previous Campaign
            </p>
            <h1 className="font-cinzel text-4xl tracking-widest uppercase shimmer-text">
              {campaign.name}
            </h1>
          </div>
        </section>

        <div className="fantasy-card p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="font-cinzel text-xs tracking-widest uppercase mb-2" style={{ color: "var(--color-text-muted)" }}>
                Status
              </p>
              <p style={{ color: "var(--color-accent-gold)" }}>{campaign.status}</p>
            </div>
            <div>
              <p className="font-cinzel text-xs tracking-widest uppercase mb-2" style={{ color: "var(--color-text-muted)" }}>
                Dungeon Master
              </p>
              <p style={{ color: "var(--color-accent-gold)" }}>{campaign.dm}</p>
            </div>
          </div>
        </div>

        <section className="fantasy-card p-6 mb-6">
          <h2 className="font-cinzel text-xl tracking-widest uppercase mb-4" style={{ color: "var(--color-text-primary)" }}>
            Notes
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {campaign.description}
          </p>
        </section>

        {(campaign.resources.length > 0 || campaign.referenceUrl) && (
          <section className="fantasy-card p-6 mb-6">
            <h2 className="font-cinzel text-xl tracking-widest uppercase mb-4" style={{ color: "var(--color-text-primary)" }}>
              Resources
            </h2>
            <div className="flex flex-wrap gap-3">
              {campaign.resources.map((resource) => (
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
              {campaign.referenceUrl && (
                <a
                  href={campaign.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-md border font-cinzel text-xs tracking-widest uppercase transition-colors hover:border-amber-400"
                  style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-secondary)" }}
                >
                  Campaign Page
                </a>
              )}
            </div>
          </section>
        )}

        {campaign.party.length > 0 && (
          <section className="fantasy-card p-6 mb-6">
            <h2 className="font-cinzel text-xl tracking-widest uppercase mb-4" style={{ color: "var(--color-text-primary)" }}>
              Roster
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {campaign.party.map((member) => (
                member.url ? (
                  <a key={member.name} href={member.url} target="_blank" rel="noopener noreferrer"
                    className="rounded-md border px-3 py-2 text-sm transition-colors hover:border-amber-400"
                    style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-secondary)" }}>
                    <span className="block">{member.name}</span>
                    {member.player && <span className="mt-1 block text-xs" style={{ color: "var(--color-text-muted)" }}>{member.player}</span>}
                  </a>
                ) : (
                  <span key={member.name} className="rounded-md border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-muted)" }}>
                    <span className="block">{member.name}</span>
                    {member.player && <span className="mt-1 block text-xs">{member.player}</span>}
                  </span>
                )
              ))}
            </div>
          </section>
        )}

        {campaign.sections.map((section) => (
          <section key={section.title} className="fantasy-card p-6 mb-6">
            <h2 className="font-cinzel text-xl tracking-widest uppercase mb-4" style={{ color: "var(--color-text-primary)" }}>
              {section.title}
            </h2>
            {section.content && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {section.content}
              </p>
            )}
            {section.entries && section.entries.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {section.entries.map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            )}
          </section>
        ))}
      </article>
    </div>
  );
}
