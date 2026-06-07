import type { Metadata } from "next";
import { getPageLayout, getPageGrid } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Pantheon",
  description: "Portal link to the Myrdae pantheon in Chronicles.",
};

export default function PantheonPage() {
  const order = getPageLayout("/pantheon");
  const grid = getPageGrid("/pantheon");
  return (
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} grid={grid} />
    </div>
  );
}
