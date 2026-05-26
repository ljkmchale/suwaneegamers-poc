import { CampaignForm } from "../CampaignForm";

export default function NewCampaignPage() {
  return (
    <div>
      <h1 className="font-cinzel text-2xl tracking-widest uppercase mb-2">New Campaign</h1>
      <p className="text-sm text-[#a89880] mb-8">Fill in the details below and click Save.</p>
      <CampaignForm isNew />
    </div>
  );
}
