import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { getPageLayout, getPageGrid } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Bestiary",
  description: "Myrdae creature references, portraits, and stat block links.",
};

const bestiarySourceUrl = "https://sites.google.com/view/suwanee-gamers/bestiary";

// ── Sections ──────────────────────────────────────────────────────────────────

function HeaderSection() {
  return (
    <header className="mb-14 text-center max-w-6xl mx-auto px-6 pt-4">
      <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3"
        style={{ color: "var(--color-accent-arcane)" }}>
        Creature Archive
      </p>
      <h1 className="font-cinzel text-4xl tracking-widest uppercase mb-4 shimmer-text">
        Bestiary
      </h1>
      <p className="max-w-3xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
        Creature portraits and stat block links for the Suwanee Gamers table.
      </p>
      <a href={bestiarySourceUrl} target="_blank" rel="noopener noreferrer"
        className="mt-5 inline-flex items-center gap-2 text-sm font-cinzel tracking-widest uppercase transition-colors hover:text-amber-400"
        style={{ color: "var(--color-accent-gold)" }}>
        Source Page
        <ExternalLink aria-hidden="true" className="h-4 w-4" />
      </a>
    </header>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BestiaryPage() {
  const order = getPageLayout("/bestiary");
  const grid = getPageGrid("/bestiary");
  return (
    <div className="relative min-h-screen pb-20">
      <PageBlockList
        items={order}
        grid={grid}
        sections={{ header: <HeaderSection /> }}
      />
    </div>
  );
}
