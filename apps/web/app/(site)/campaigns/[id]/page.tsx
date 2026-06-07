import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageBlockList } from "@/components/blocks/PageBlockList";
import { activeCampaigns, findCampaign } from "@/lib/campaigns";
import { getPageLayout } from "@/lib/pageLayouts";

interface Props {
  params: Promise<{ id: string }>;
}

export const revalidate = 300;

export function generateStaticParams() {
  return activeCampaigns.map((campaign) => ({ id: campaign.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const campaign = findCampaign(id);
  return {
    title: campaign?.name ?? "Campaign",
    description: campaign?.description ?? "Suwanee Gamers campaign portal page.",
  };
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const campaign = findCampaign(id);

  if (!campaign) notFound();

  const items = getPageLayout(`/campaigns/${campaign.id}`);

  return (
    <div className="relative min-h-screen pb-20 pt-20">
      <PageBlockList items={items} />
    </div>
  );
}
