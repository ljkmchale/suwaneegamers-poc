import type { Metadata } from "next";
import { getPageGrid, getPageLayout } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Campaign Setting",
  description: "Myrdae campaign setting references, lore, and worldbuilding resources.",
};

export default function CampaignSettingPage() {
  const order = getPageLayout("/campaign-setting");
  const grid = getPageGrid("/campaign-setting");

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        aria-hidden="true"
        style={{
          backgroundImage:
            'url("/images/guides-to-myrdae/reference-cards/campaign-setting-full-setting-guide.webp")',
        }}
      />
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.8) 0%, rgba(8,5,15,0.7) 34%, rgba(8,5,15,0.95) 100%), linear-gradient(90deg, rgba(8,5,15,0.62), rgba(8,5,15,0.28), rgba(8,5,15,0.66))",
        }}
      />
      <div className="relative z-10 pb-20">
        <PageBlockList items={order} grid={grid} />
      </div>
    </div>
  );
}
