import { notFound } from "next/navigation";
import { findCampaign } from "@/lib/campaigns";
import { CampaignForm } from "../CampaignForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCampaignPage({ params }: Props) {
  const { id } = await params;
  const campaign = findCampaign(id);
  if (!campaign) notFound();

  return (
    <div>
      <h1 className="font-cinzel text-2xl tracking-widest uppercase mb-2">Edit Campaign</h1>
      <p className="text-sm text-[#a89880] mb-8">{campaign.name}</p>
      <CampaignForm campaign={campaign} />
    </div>
  );
}
