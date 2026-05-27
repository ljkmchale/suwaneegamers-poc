import type { Metadata } from "next";
import { getPageLayout } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "History",
  description: "Portal link to Myrdae history in the Knowledge Base.",
};

export default function HistoryPage() {
  const order = getPageLayout("/history");
  return (
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} />
    </div>
  );
}
