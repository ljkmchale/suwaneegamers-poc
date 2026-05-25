import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/PortalPage";
import { kbLink, PORTAL_URLS } from "@/lib/portal";

export const metadata: Metadata = {
  title: "Legends & Lore",
  description: "Portal link to canonical Myrdae lore.",
};

export default function LorePage() {
  return (
    <PortalPage
      eyebrow="Knowledge Base"
      title="Legends & Lore"
      description="Myrdae canon belongs in the Knowledge Base. This portal should not duplicate or drift from it."
      links={[
        kbLink("Open the canonical lore, histories, myths, factions, and world notes."),
        {
          title: "Original Google Site",
          description: "Reference the legacy lore pages while the Knowledge Base remains the source of truth.",
          href: PORTAL_URLS.referenceSite,
          label: "Open Reference",
        },
      ]}
    />
  );
}
