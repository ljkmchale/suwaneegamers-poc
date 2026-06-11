import type { Metadata } from "next";
import { PageBlockList } from "@/components/blocks/PageBlockList";
import { getPageGrid, getPageLayout } from "@/lib/pageLayouts";

export const metadata: Metadata = {
  title: "Organizations (Factions)",
  description: "Myrdae organizations, factions, guilds, orders, and hidden powers.",
};

export const revalidate = 86400;

export default function OrganizationsPage() {
  const order = getPageLayout("/organizations");
  const grid = getPageGrid("/organizations");

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        aria-hidden="true"
        style={{
          backgroundImage:
            'url("/images/guides-to-myrdae/reference-cards/campaign-setting-factions.webp")',
        }}
      />
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.82) 0%, rgba(8,5,15,0.7) 38%, rgba(8,5,15,0.95) 100%), linear-gradient(90deg, rgba(8,5,15,0.72), rgba(8,5,15,0.34), rgba(8,5,15,0.7))",
        }}
      />

      <div className="relative z-10 pt-12">
        <PageBlockList items={order} grid={grid} />
      </div>
    </div>
  );
}
