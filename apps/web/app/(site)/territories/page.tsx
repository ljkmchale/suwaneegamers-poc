import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/PortalPage";
import { kbLink } from "@/lib/portal";

export const metadata: Metadata = {
  title: "Territories",
  description: "Portal link to Myrdae territories in the Knowledge Base.",
};

export default function TerritoriesPage() {
  return (
    <PortalPage
      eyebrow="Knowledge Base"
      title="Territories"
      description="Political regions, settlements, factions, and territory notes are maintained in the Knowledge Base."
      links={[kbLink("Open canonical territory and region references.")]}
    />
  );
}
