import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/PortalPage";
import { kbLink, PORTAL_URLS } from "@/lib/portal";

export const metadata: Metadata = {
  title: "Maps of Myrdae",
  description: "Portal links for Myrdae map resources.",
};

export default function MapsOfMyrdaePage() {
  return (
    <PortalPage
      eyebrow="Map Portal"
      title="Maps of Myrdae"
      description="This page is the doorway for map resources. The Knowledge Base should remain the canonical location index."
      links={[
        kbLink("Open canonical map notes, locations, territories, and table handouts."),
        {
          title: "Legacy Map Pages",
          description: "Open the original Google Site map pages for comparison and reference.",
          href: PORTAL_URLS.referenceSite,
          label: "Open Legacy Site",
        },
      ]}
    />
  );
}
