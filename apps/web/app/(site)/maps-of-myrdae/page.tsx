import type { Metadata } from "next";
import { getAutoManagedPages } from "@/lib/autoManagedPagesData";
import { listRatingSummaries } from "@/lib/adventsGuide";
import { AdventsGuideMap } from "./AdventsGuideMap";

export const metadata: Metadata = {
  title: "Maps of Myrdae",
  description: "Live interactive map of Myrdae.",
};

const MAP_URL_FALLBACK = "https://mapeditor.suwaneegamers.net/embed-map.html";
const MAP_EMBED_VERSION = "underdark-20260701-1";

export default function MapsOfMyrdaePage() {
  const entry = getAutoManagedPages().find((p) => p.path === "/maps-of-myrdae");
  const src = entry?.sourceUrl || MAP_URL_FALLBACK;
  const versionedSrc = `${src}${src.includes("?") ? "&" : "?"}v=${MAP_EMBED_VERSION}`;

  return <AdventsGuideMap src={versionedSrc} initialRatings={listRatingSummaries()} />;
}
