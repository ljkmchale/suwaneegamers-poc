import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/PortalPage";
import { kbLink } from "@/lib/portal";

export const metadata: Metadata = {
  title: "Gazetteer",
  description: "Portal link to Myrdae locations in the Knowledge Base.",
};

export default function GazetteerPage() {
  return (
    <PortalPage
      eyebrow="Knowledge Base"
      title="Gazetteer"
      description="Cities, ruins, taverns, wilderness sites, and other locations are maintained in the Knowledge Base."
      links={[kbLink("Open canonical Myrdae locations and place notes.")]}
    />
  );
}
