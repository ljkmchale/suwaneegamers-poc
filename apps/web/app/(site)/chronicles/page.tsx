import type { Metadata } from "next";
import { getAutoManagedPages } from "@/lib/autoManagedPagesData";

export const metadata: Metadata = {
  title: "Chronicles",
  description: "Campaign Brain — the Suwanee Gamers chronicles and knowledge base.",
};

const CHRONICLES_FALLBACK = "https://kb.suwaneegamers.net/";

export default function ChroniclesPage() {
  const entry = getAutoManagedPages().find((p) => p.path === "/chronicles");
  const src = entry?.sourceUrl || CHRONICLES_FALLBACK;

  return (
    <div className="h-[calc(100vh-4rem)] w-full">
      <iframe
        src={src}
        title="Suwanee Gamers Chronicles"
        className="h-full w-full"
        style={{ border: "none", background: "#07101d" }}
        allowFullScreen
      />
    </div>
  );
}
