import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/PortalPage";
import { kbLink, PORTAL_URLS } from "@/lib/portal";

export const metadata: Metadata = {
  title: "World Map",
  description: "Portal links for Myrdae maps and location references.",
};

export default function WorldPage() {
  return (
    <PortalPage
      eyebrow="Map Portal"
      title="The World of Myrdae"
      description="Map and location truth should live outside this app. Use the portal to reach the Knowledge Base and map resources."
      links={[
        kbLink("Open canonical Myrdae map notes, locations, and territory references."),
        {
          title: "Maps of Myrdae",
          description: "Open the local map doorway for interactive and reference map links.",
          href: PORTAL_URLS.maps,
          label: "View Maps",
        },
      ]}
    />
  );
}
