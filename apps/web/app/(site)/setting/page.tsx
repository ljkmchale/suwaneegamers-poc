import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/PortalPage";

export const metadata: Metadata = {
  title: "Setting",
  description: "Portal link to the canonical Myrdae setting guide.",
};

const settingGuideUrl =
  "https://docs.google.com/document/d/1PGWzoocfjPNQ69Q-JsVmNXCFo76a3Z_IkcBuBeDj4yQ/edit?tab=t.0#heading=h.xpbfs6nn72lr";

export default function SettingPage() {
  return (
    <PortalPage
      eyebrow="Setting Guide"
      title="Myrdae Setting"
      description="The setting guide, campaign canon, and world rules are maintained in the shared Google Doc."
      links={[
        {
          title: "Myrdae Setting Guide",
          description: "Open the canonical setting guide at the linked Google Doc heading.",
          href: settingGuideUrl,
          label: "Open Setting",
        },
      ]}
    />
  );
}
