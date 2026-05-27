import type { Metadata } from "next";
import { getPageLayout } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Gazetteer",
  description: "Portal link to Myrdae locations in the Knowledge Base.",
};

export default function GazetteerPage() {
  const order = getPageLayout("/gazetteer");
  return (
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} />
    </div>
  );
}
