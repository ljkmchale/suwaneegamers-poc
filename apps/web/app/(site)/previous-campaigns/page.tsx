import type { Metadata } from "next";
import { getArchivedCampaigns } from "@/lib/archivedCampaigns";
import { getTrackedArchivedCampaigns } from "@/lib/campaignTracking";
import { getPageLayout, getPageGrid } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";
import type { BlockItem, PageItem } from "@/lib/pageBlocks";

export const metadata: Metadata = {
  title: "Previous Campaigns",
  description: "Portal links for archived campaign information.",
};

export default async function PreviousCampaignsPage() {
  const campaigns = await getTrackedArchivedCampaigns(getArchivedCampaigns());
  const byId = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const order = getPageLayout("/previous-campaigns").map((item): PageItem => {
    if (item.kind !== "block" || item.type !== "archived-campaign-card") return item;
    const id = item.props.id as string | undefined;
    const campaign = id ? byId.get(id) : undefined;
    if (!campaign) return item;

    return {
      ...(item as BlockItem),
      props: {
        ...item.props,
        title: campaign.name,
        status: campaign.status,
        dm: campaign.dm,
      },
    };
  });
  const grid = getPageGrid("/previous-campaigns");
  return (
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} grid={grid} />
    </div>
  );
}
