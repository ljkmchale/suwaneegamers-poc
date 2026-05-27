import type { Metadata } from "next";
import { getPageLayout } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "World Map",
  description: "Portal links for Myrdae maps and location references.",
};

export default function WorldPage() {
  const order = getPageLayout("/world");
  return (
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} />
    </div>
  );
}
