import type { Metadata } from "next";
import { PageBlockList } from "@/components/blocks/PageBlockList";
import { getPageGrid, getPageLayout } from "@/lib/pageLayouts";

export const metadata: Metadata = {
  title: "References (Sourcebooks)",
  description: "Sourcebooks, adventures, and table references for Suwanee Gamers.",
};

export default function ReferencesPage() {
  const order = getPageLayout("/references");
  const grid = getPageGrid("/references");

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        aria-hidden="true"
        style={{
          backgroundImage:
            'url("/images/references-sourcebooks/references-sourcebooks-overview.webp")',
        }}
      />
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.82) 0%, rgba(8,5,15,0.72) 36%, rgba(8,5,15,0.96) 100%), linear-gradient(90deg, rgba(8,5,15,0.7), rgba(8,5,15,0.34), rgba(8,5,15,0.72))",
        }}
      />
      <div className="relative z-10 pb-20">
        <PageBlockList items={order} grid={grid} />
      </div>
    </div>
  );
}
