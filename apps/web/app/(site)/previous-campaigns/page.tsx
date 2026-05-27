import type { Metadata } from "next";
import { getPageLayout } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Previous Campaigns",
  description: "Portal links for archived campaign information.",
};

export default function PreviousCampaignsPage() {
  const order = getPageLayout("/previous-campaigns");
  return (
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} />
    </div>
  );
}
