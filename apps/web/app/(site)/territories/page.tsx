import type { Metadata } from "next";
import { getPageLayout, getPageGrid } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Territories",
  description: "Portal link to Myrdae territories in Chronicles.",
};

export default function TerritoriesPage() {
  const order = getPageLayout("/territories");
  const grid = getPageGrid("/territories");
  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        aria-hidden="true"
        style={{ backgroundImage: 'url("/images/maps-of-myrdae/territories-map.webp")' }}
      />
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.82) 0%, rgba(8,5,15,0.72) 36%, rgba(8,5,15,0.96) 100%), linear-gradient(90deg, rgba(8,5,15,0.7), rgba(8,5,15,0.34), rgba(8,5,15,0.72))",
        }}
      />
      <div className="relative z-10 pb-20">
        <PageBlockList items={order} grid={grid} />
      </div>
    </div>
  );
}
