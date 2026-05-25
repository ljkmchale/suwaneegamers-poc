import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/PortalPage";
import { kbLink } from "@/lib/portal";

export const metadata: Metadata = {
  title: "Pantheon",
  description: "Portal link to the Myrdae pantheon in the Knowledge Base.",
};

export default function PantheonPage() {
  return (
    <PortalPage
      eyebrow="Knowledge Base"
      title="Pantheon"
      description="The gods, divine factions, and religious history of Myrdae are canonical in the Knowledge Base."
      links={[kbLink("Open the canonical pantheon and religion references.")]}
    />
  );
}
