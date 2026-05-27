import type { Metadata } from "next";
import { getPageLayout } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Territories",
  description: "Portal link to Myrdae territories in the Knowledge Base.",
};

export default function TerritoriesPage() {
  const order = getPageLayout("/territories");
  return (
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} />
    </div>
  );
}
