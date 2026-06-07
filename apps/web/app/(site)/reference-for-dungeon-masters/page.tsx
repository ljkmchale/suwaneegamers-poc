import type { Metadata } from "next";
import { getPageGrid, getPageLayout } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Reference for Dungeon Masters",
  description: "Dungeon Master references, house rules, tables, and campaign tools for Myrdae.",
};

export default function ReferenceForDungeonMastersPage() {
  const order = getPageLayout("/reference-for-dungeon-masters");
  const grid = getPageGrid("/reference-for-dungeon-masters");

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        aria-hidden="true"
        style={{
          backgroundImage:
            'url("/images/guides-to-myrdae/reference-cards/dm-reference-background.webp")',
        }}
      />
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.8) 0%, rgba(8,5,15,0.7) 36%, rgba(8,5,15,0.95) 100%), linear-gradient(90deg, rgba(8,5,15,0.62), rgba(8,5,15,0.28), rgba(8,5,15,0.66))",
        }}
      />
      <div className="relative z-10 pb-20">
        <PageBlockList items={order} grid={grid} />
      </div>
    </div>
  );
}
