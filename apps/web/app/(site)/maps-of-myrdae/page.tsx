import type { Metadata } from "next";
import { getPageLayout } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Maps of Myrdae",
  description: "Portal links for Myrdae map resources.",
};

export default function MapsOfMyrdaePage() {
  const order = getPageLayout("/maps-of-myrdae");
  return (
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} />
    </div>
  );
}
