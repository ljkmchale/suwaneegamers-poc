import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/PortalPage";
import { kbLink } from "@/lib/portal";

export const metadata: Metadata = {
  title: "History",
  description: "Portal link to Myrdae history in the Knowledge Base.",
};

export default function HistoryPage() {
  return (
    <PortalPage
      eyebrow="Knowledge Base"
      title="History"
      description="The canonical timeline, eras, and historical notes are maintained in the Knowledge Base."
      links={[kbLink("Open the Myrdae timeline and history references.")]}
    />
  );
}
