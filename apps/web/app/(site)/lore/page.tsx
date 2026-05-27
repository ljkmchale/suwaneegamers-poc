import type { Metadata } from "next";
import { getPageLayout } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Legends & Lore",
  description: "Portal link to canonical Myrdae lore.",
};

export default function LorePage() {
  const order = getPageLayout("/lore");
  return (
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} />
    </div>
  );
}
