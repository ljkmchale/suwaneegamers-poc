import type { Metadata } from "next";
import { getPageLayout, getPageGrid } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Campaigns",
  description: "Active Suwanee Gamers campaigns, Dungeon Masters, schedules, and next session dates.",
};

export const revalidate = 300;

// ── Sections ──────────────────────────────────────────────────────────────────

function HeaderSection() {
  return (
    <header className="mb-14 text-center max-w-6xl mx-auto px-6 pt-4">
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

function SideLabelSection() {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-6">
      <p className="font-cinzel text-xs tracking-[0.35em] uppercase"
        style={{ color: "var(--color-text-muted)" }}>
        Other Campaign Tools
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const order = getPageLayout("/campaigns");
  const grid = getPageGrid("/campaigns");
  return (
    <div className="relative min-h-screen pb-20">
      <PageBlockList
        items={order}
        grid={grid}
        sections={{
          header:     <HeaderSection />,
          "side-label": <SideLabelSection />,
        }}
      />
    </div>
  );
}
