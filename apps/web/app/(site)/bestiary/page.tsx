import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/PortalPage";
import { kbLink } from "@/lib/portal";

export const metadata: Metadata = {
  title: "Bestiary",
  description: "Portal link to Myrdae bestiary information in the Knowledge Base.",
};

export default function BestiaryPage() {
  return (
    <PortalPage
      eyebrow="Knowledge Base"
      title="Bestiary"
      description="Creature lore, encounter notes, and bestiary entries are maintained in the Knowledge Base."
      links={[kbLink("Open canonical creature and monster references.")]}
    />
  );
}
