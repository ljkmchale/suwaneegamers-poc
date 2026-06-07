import type { Metadata } from "next";
import { getPageLayout, getPageGrid } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Gazetteer",
  description: "Portal link to Myrdae locations in Chronicles.",
};

export default function GazetteerPage() {
  const order = getPageLayout("/gazetteer");
  const grid = getPageGrid("/gazetteer");
  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div className="art-bg-silver fixed inset-0 z-0" aria-hidden="true" />
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.78) 0%, rgba(8,5,15,0.68) 36%, rgba(8,5,15,0.94) 100%), linear-gradient(90deg, rgba(8,5,15,0.48), rgba(8,5,15,0.2), rgba(8,5,15,0.58))",
        }}
      />
      <div className="relative z-10 pb-20">
        <PageBlockList items={order} grid={grid} />
      </div>
    </div>
  );
}
