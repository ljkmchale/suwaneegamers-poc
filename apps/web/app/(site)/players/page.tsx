import Link from "next/link";
import type { Metadata } from "next";
import { getPlayerProfiles, getUnassignedCharacters } from "@/lib/players";
import { getPageLayout } from "@/lib/pageLayouts";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { PageItem } from "@/lib/pageBlocks";

export const metadata: Metadata = {
  title: "Players",
  description: "Suwanee Gamers player profiles, active characters, and campaign assignments.",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

// ── Sections ──────────────────────────────────────────────────────────────────

function HeaderSection() {
  return (
    <header className="mb-14 text-center">
      <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3"
        style={{ color: "var(--color-accent-arcane)" }}>
        Table Roster
      </p>
      <h1 className="font-cinzel text-4xl tracking-widest uppercase mb-4 shimmer-text">
        Players
      </h1>
      <p className="max-w-3xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
        Player profiles, current characters, and the campaigns each character belongs to.
      </p>
    </header>
  );
}

function PlayersSection({ players }: { players: ReturnType<typeof getPlayerProfiles> }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {players.map((player) => (
        <article key={player.id} className="fantasy-card overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] min-h-64">
            <div
              className="min-h-56 border-b sm:border-b-0 sm:border-r"
              style={{
                borderColor: "var(--color-bg-border)",
                background: player.portrait
                  ? `linear-gradient(to bottom, rgba(8, 5, 15, 0.04), rgba(8, 5, 15, 0.64)), url("${player.portrait}") center / cover no-repeat`
                  : "linear-gradient(135deg, rgba(139, 92, 246, 0.28), rgba(245, 158, 11, 0.14))",
              }}
              role="img"
              aria-label={`${player.name} profile image`}
            >
              {!player.portrait && (
                <div className="flex h-full min-h-56 items-center justify-center">
                  <span className="font-cinzel text-5xl" style={{ color: "var(--color-text-primary)" }}>
                    {initials(player.name)}
                  </span>
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-cinzel text-2xl leading-tight" style={{ color: "var(--color-text-primary)" }}>
                    {player.name}
                  </h2>
                  {player.dmProfileId && (
                    <Link href="/dungeon-masters"
                      className="mt-2 inline-block text-xs font-cinzel tracking-widest uppercase transition-colors hover:text-amber-400"
                      style={{ color: "var(--color-accent-gold)" }}>
                      Dungeon Master
                    </Link>
                  )}
                </div>
                <span
                  className="shrink-0 text-xs font-cinzel tracking-widest uppercase px-2.5 py-1 rounded-full border self-start"
                  style={{
                    color: player.assignments.length ? "var(--color-accent-arcane)" : "var(--color-text-muted)",
                    borderColor: player.assignments.length ? "var(--color-accent-arcane)" : "var(--color-bg-border)",
                  }}>
                  {player.assignments.length} Character{player.assignments.length === 1 ? "" : "s"}
                </span>
              </div>

              <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--color-text-secondary)" }}>
                {player.description}
              </p>

              <div className="space-y-3">
                {player.assignments.map(({ character, campaign }) => (
                  <div key={`${campaign.id}-${character.name}`}
                    className="rounded-md border px-3 py-3"
                    style={{ borderColor: "var(--color-bg-border)" }}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        {character.url ? (
                          <a href={character.url} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-semibold transition-colors hover:text-amber-400"
                            style={{ color: "var(--color-text-primary)" }}>
                            {character.name}
                          </a>
                        ) : (
                          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                            {character.name}
                          </span>
                        )}
                        <Link href={`/campaigns/${campaign.id}`}
                          className="block text-xs mt-1 transition-colors hover:text-amber-400"
                          style={{ color: "var(--color-text-muted)" }}>
                          {campaign.name}
                        </Link>
                      </div>
                      <span className="text-xs" style={{ color: "var(--color-accent-gold)" }}>
                        DM: {campaign.dm}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function UnassignedSection({ unassigned }: { unassigned: ReturnType<typeof getUnassignedCharacters> }) {
  if (unassigned.length === 0) return null;
  return (
    <section className="mt-10 fantasy-card p-6">
      <h2 className="font-cinzel text-xl tracking-widest uppercase mb-3" style={{ color: "var(--color-text-primary)" }}>
        Characters Needing Players
      </h2>
      <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
        These character links are already in the portal, but we still need to attach player names.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {unassigned.map(({ character, campaign }) => (
          <div key={`${campaign.id}-${character.name}`}
            className="rounded-md border px-3 py-3"
            style={{ borderColor: "var(--color-bg-border)" }}>
            {character.url ? (
              <a href={character.url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-semibold transition-colors hover:text-amber-400"
                style={{ color: "var(--color-text-primary)" }}>
                {character.name}
              </a>
            ) : (
              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {character.name}
              </span>
            )}
            <Link href={`/campaigns/${campaign.id}`}
              className="block text-xs mt-1 transition-colors hover:text-amber-400"
              style={{ color: "var(--color-text-muted)" }}>
              {campaign.name}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlayersPage() {
  const players = getPlayerProfiles();
  const unassigned = getUnassignedCharacters();
  const order = getPageLayout("/players");

  const sectionMap: Record<string, React.ReactNode> = {
    "header":     <HeaderSection key="header" />,
    "players":    <PlayersSection key="players" players={players} />,
    "unassigned": <UnassignedSection key="unassigned" unassigned={unassigned} />,
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
