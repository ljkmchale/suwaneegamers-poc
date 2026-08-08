import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageBlockList } from "@/components/blocks/PageBlockList";
import type { PageItem } from "@/lib/pageBlocks";
import type { PortalCampaign } from "@/lib/campaigns";
import { activeCampaigns, findCampaign, getActiveCampaigns } from "@/lib/campaigns";
import { findTrackedCampaign } from "@/lib/campaignTracking";
import {
  enrichCampaignRosterCard,
  personalizeCampaignDndBeyondLink,
  replaceCampaignSessionsCard,
} from "@/lib/campaignDetailLayouts";
import { getPageLayout } from "@/lib/pageLayouts";
import { getUserProfileContext } from "@/lib/userProfiles";
import { getUserSession, isSignedIn } from "@/lib/userSession";

interface Props {
  params: Promise<{ id: string }>;
}

export const revalidate = 300;

export function generateStaticParams() {
  return activeCampaigns.map((campaign) => ({ id: campaign.id }));
}

function replaceTrackedCampaignFields(items: PageItem[], campaign: PortalCampaign): PageItem[] {
  return items.map((item) => {
    if (item.kind !== "block") return item;

    if (item.type === "campaign-hero") {
      return {
        ...item,
        props: {
          ...item.props,
          title: campaign.name,
          image: campaign.headerImage ?? "",
          imagePosition: campaign.headerImagePosition ?? "center",
        },
      };
    }

    if (item.type === "campaign-meta") {
      return {
        ...item,
        props: {
          ...item.props,
          schedule: campaign.schedule,
          dm: campaign.dm,
          campaignName: campaign.name,
          startDate: campaign.startDate ?? "",
        },
      };
    }

    return item;
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const campaign = await findTrackedCampaign(getActiveCampaigns(), id) ?? findCampaign(id);
  return {
    title: campaign?.name ?? "Campaign",
    description: campaign?.description ?? "Suwanee Gamers campaign portal page.",
  };
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const campaign = await findTrackedCampaign(getActiveCampaigns(), id) ?? findCampaign(id);

  if (!campaign) notFound();

  const session = await getUserSession();
  const playerName = isSignedIn(session)
    ? getUserProfileContext(session).profile.playerName
    : undefined;
  const trackedItems = replaceTrackedCampaignFields(getPageLayout(`/campaigns/${campaign.id}`), campaign);
  const refreshedItems = enrichCampaignRosterCard(replaceCampaignSessionsCard(trackedItems, campaign), campaign);
  const items = personalizeCampaignDndBeyondLink(refreshedItems, campaign, playerName);

  return (
    <div className="relative min-h-screen pb-20 pt-20">
      <PageBlockList items={items} />
    </div>
  );
}
