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
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} grid={grid} />
    </div>
  );
}
