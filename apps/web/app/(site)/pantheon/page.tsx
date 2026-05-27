import type { Metadata } from "next";
import { getPageLayout } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Pantheon",
  description: "Portal link to the Myrdae pantheon in the Knowledge Base.",
};

export default function PantheonPage() {
  const order = getPageLayout("/pantheon");
  return (
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} />
    </div>
  );
}
