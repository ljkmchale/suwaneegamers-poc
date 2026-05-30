import Link from "next/link";
import type { Metadata } from "next";
import { getUnassignedCharacters } from "@/lib/players";
import { getPageLayout, getPageGrid } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Players",
  description: "Suwanee Gamers player profiles, active characters, and campaign assignments.",
};

// ── Sections ──────────────────────────────────────────────────────────────────

function HeaderSection() {
  return (
    <header className="mb-14 text-center max-w-6xl mx-auto px-6 pt-4">
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

function UnassignedSection({ unassigned }: { unassigned: ReturnType<typeof getUnassignedCharacters> }) {
  if (unassigned.length === 0) return null;
  return (
    <section className="max-w-6xl mx-auto px-6 mt-10 fantasy-card p-6">
      <h2 className="font-cinzel text-xl tracking-widest uppercase mb-3"
        style={{ color: "var(--color-text-primary)" }}>
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
  const unassigned = getUnassignedCharacters();
  const order = getPageLayout("/players");
  const grid = getPageGrid("/players");
  return (
    <div className="relative min-h-screen pb-20">
      <PageBlockList
        items={order}
        grid={grid}
        sections={{
          header:     <HeaderSection />,
          unassigned: <UnassignedSection unassigned={unassigned} />,
        }}
      />
    </div>
  );
}
