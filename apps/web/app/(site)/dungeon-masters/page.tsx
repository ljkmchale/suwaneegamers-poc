import Link from "next/link";
import type { Metadata } from "next";
import {
  campaignsForDm,
  dungeonMasters,
  dungeonMastersReferenceUrl,
} from "@/lib/dungeonMasters";
import { PORTAL_URLS } from "@/lib/portal";

export const metadata: Metadata = {
  title: "Dungeon Masters",
  description: "Suwanee Gamers Dungeon Master cards with active and archived campaign history.",
};

export default function DungeonMastersPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      <header className="mb-14 text-center">
        <p
          className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3"
          style={{ color: "var(--color-accent-arcane)" }}
        >
          DM Roster
        </p>
        <h1 className="font-cinzel text-4xl tracking-widest uppercase mb-4 shimmer-text">
          Dungeon Masters
        </h1>
        <p className="max-w-3xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
          The people behind the screen, their active tables, and the campaign history currently
          represented on the Suwanee Gamers reference site.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={dungeonMastersReferenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-cinzel tracking-widest uppercase px-4 py-2 border rounded-full transition-colors hover:border-amber-400"
            style={{ color: "var(--color-accent-gold)", borderColor: "var(--color-bg-border)" }}
          >
            Reference Site
          </a>
          <a
            href={PORTAL_URLS.knowledgeBase}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-cinzel tracking-widest uppercase px-4 py-2 border rounded-full transition-colors hover:border-amber-400"
            style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-bg-border)" }}
          >
            Knowledge Base
          </a>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {dungeonMasters.map((profile) => {
          const active = campaignsForDm(profile);

          return (
            <article key={profile.id} className="fantasy-card overflow-hidden">
              {profile.portrait && (
                <div
                  className="h-72 border-b"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, rgba(8, 5, 15, 0.02), rgba(8, 5, 15, 0.62)), url("${profile.portrait}")`,
                    backgroundPosition: "center center",
                    backgroundSize: "cover",
                    backgroundRepeat: "no-repeat",
                    borderColor: "var(--color-bg-border)",
                  }}
                  role="img"
                  aria-label={`${profile.name} portrait`}
                />
              )}
              <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                <div>
                  <h2 className="font-cinzel text-2xl leading-tight" style={{ color: "var(--color-text-primary)" }}>
                    {profile.name}
                  </h2>
                  <p className="text-sm mt-2" style={{ color: "var(--color-accent-gold)" }}>
                    {profile.focus}
                  </p>
                </div>
                <span
                  className="shrink-0 text-xs font-cinzel tracking-widest uppercase px-2.5 py-1 rounded-full border self-start"
                  style={{
                    color: active.length ? "var(--color-accent-arcane)" : "var(--color-text-muted)",
                    borderColor: active.length ? "var(--color-accent-arcane)" : "var(--color-bg-border)",
                  }}
                >
                  {active.length ? "Active DM" : "Archive"}
                </span>
              </div>

              <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--color-text-secondary)" }}>
                {profile.description}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <section>
                  <h3
                    className="font-cinzel text-xs tracking-widest uppercase mb-3"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Active Campaigns
                  </h3>
                  {active.length ? (
                    <div className="space-y-3">
                      {active.map((campaign) => (
                        <Link
                          key={campaign.id}
                          href={`/campaigns/${campaign.id}`}
                          className="block rounded-md border px-3 py-3 transition-colors hover:border-amber-400"
                          style={{ borderColor: "var(--color-bg-border)" }}
                        >
                          <span className="block text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                            {campaign.name}
                          </span>
                          <span className="block text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                            {campaign.schedule}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                      No active campaign listed on the reference site.
                    </p>
                  )}
                </section>

                <section>
                  <h3
                    className="font-cinzel text-xs tracking-widest uppercase mb-3"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Campaign History
                  </h3>
                  <div className="space-y-2">
                    {profile.previousCampaigns.map((campaign) => (
                      <div
                        key={campaign.name}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                        style={{ borderColor: "var(--color-bg-border)" }}
                      >
                        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                          {campaign.name}
                        </span>
                        <span
                          className="text-[0.68rem] font-cinzel tracking-widest uppercase"
                          style={{
                            color:
                              campaign.status === "Completed"
                                ? "var(--color-accent-gold)"
                                : "var(--color-accent-ice)",
                          }}
                        >
                          {campaign.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
