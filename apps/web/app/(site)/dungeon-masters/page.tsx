import type { Metadata } from "next";
import { dungeonMastersReferenceUrl } from "@/lib/dungeonMasters";
import { PORTAL_URLS } from "@/lib/portal";
import { getPageLayout, getPageGrid } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Dungeon Masters",
  description: "Suwanee Gamers Dungeon Master cards with active and archived campaign history.",
};

// ── Header section ────────────────────────────────────────────────────────────

function HeaderSection() {
  return (
    <header className="max-w-6xl mx-auto px-6 pt-20 mb-14 text-center">
      <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3"
        style={{ color: "var(--color-accent-arcane)" }}>
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
        <a href={dungeonMastersReferenceUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs font-cinzel tracking-widest uppercase px-4 py-2 border rounded-full transition-colors hover:border-amber-400"
          style={{ color: "var(--color-accent-gold)", borderColor: "var(--color-bg-border)" }}>
          Reference Site
        </a>
        <a href={PORTAL_URLS.knowledgeBase} target="_blank" rel="noopener noreferrer"
          className="text-xs font-cinzel tracking-widest uppercase px-4 py-2 border rounded-full transition-colors hover:border-amber-400"
          style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-bg-border)" }}>
          Knowledge Base
        </a>
      </div>
    </header>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DungeonMastersPage() {
  const order = getPageLayout("/dungeon-masters");
  const grid = getPageGrid("/dungeon-masters");

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div className="art-bg-copper fixed inset-0 z-0" aria-hidden="true" />
      <div className="absolute inset-0 z-0" style={{
        background: "linear-gradient(180deg, rgba(8,5,15,0.78) 0%, rgba(8,5,15,0.68) 36%, rgba(8,5,15,0.92) 100%), linear-gradient(90deg, rgba(8,5,15,0.42), rgba(8,5,15,0.2), rgba(8,5,15,0.52))",
      }} />
      <div className="relative z-10 pb-20">
        <PageBlockList items={order} grid={grid} sections={{ header: <HeaderSection /> }} />
      </div>
    </div>
  );
}
