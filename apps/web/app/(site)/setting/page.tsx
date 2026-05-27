import type { Metadata } from "next";
import { getPageLayout } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

export const metadata: Metadata = {
  title: "Setting",
  description: "Portal link to the canonical Myrdae setting guide.",
};

export default function SettingPage() {
  const order = getPageLayout("/setting");
  return (
    <div className="min-h-screen pb-20">
      <PageBlockList items={order} />
    </div>
  );
}
