import type { Metadata } from "next";
import { getCampaignJourneys } from "@/lib/campaignJourneys";
import { CampaignJourneysClient } from "./CampaignJourneysClient";

export const metadata: Metadata = {
  title: "Myrdae in Motion",
  description:
    "Explore the paths, current locations, and world-changing effects of every active Myrdae campaign.",
};

export const revalidate = 300;

export default function CampaignJourneysPage() {
  return (
    <div className="relative min-h-screen pt-5">
      <CampaignJourneysClient document={getCampaignJourneys()} />
    </div>
  );
}
