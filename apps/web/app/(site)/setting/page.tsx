import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/PortalPage";
import { kbLink, PORTAL_URLS } from "@/lib/portal";

export const metadata: Metadata = {
  title: "Setting",
  description: "Portal link to the canonical Myrdae setting in the Knowledge Base.",
};

export default function SettingPage() {
  return (
    <PortalPage
      eyebrow="Knowledge Base"
      title="Myrdae Setting"
      description="The setting guide, campaign canon, and world rules belong in the Knowledge Base so this portal stays current by linking out."
      links={[
        kbLink("Open the canonical Myrdae setting guide and campaign world information."),
        {
          title: "Original Google Site",
          description: "Open the legacy setting pages for reference while the portal is modeled after it.",
          href: PORTAL_URLS.referenceSite,
          label: "Open Reference",
        },
      ]}
    />
  );
}
