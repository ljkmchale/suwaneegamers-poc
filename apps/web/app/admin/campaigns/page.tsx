import Link from "next/link";
import { getActiveCampaigns } from "@/lib/campaigns";
import { SortableCampaignList } from "./SortableCampaignList";

export default function AdminCampaignsPage() {
  const campaigns = getActiveCampaigns().map(({ id, name, dm, schedule, official }) => ({
    id, name, dm, schedule, official,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-cinzel text-3xl tracking-widest uppercase">Campaigns</h1>
          <p className="text-sm text-[#a89880] mt-1">Drag rows to reorder. Click Edit to change details.</p>
        </div>
        <Link
          href="/admin/campaigns/new"
          className="px-4 py-2 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors"
        >
          + New Campaign
        </Link>
      </div>

      <SortableCampaignList initial={campaigns} />
    </div>
  );
}
