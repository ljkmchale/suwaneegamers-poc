import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/PortalPage";
import { kbLink, PORTAL_URLS } from "@/lib/portal";

export const metadata: Metadata = {
  title: "Previous Campaigns",
  description: "Portal links for archived campaign information.",
};

export default function PreviousCampaignsPage() {
  return (
    <PortalPage
      eyebrow="Campaign Archive"
      title="Previous Campaigns"
      description="Completed and archived campaigns should be maintained in the Knowledge Base so the portal stays lightweight."
      links={[
        kbLink("Open archived campaigns, old recaps, and legacy table lore."),
        {
          title: "Original Google Site",
          description: "Open the original campaign pages for reference while archives are consolidated.",
          href: PORTAL_URLS.referenceSite,
          label: "Open Legacy Site",
        },
      ]}
    />
  );
}
