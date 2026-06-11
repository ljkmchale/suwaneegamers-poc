import type { Metadata } from "next";
import { getAutoManagedPages } from "@/lib/autoManagedPagesData";

export const metadata: Metadata = {
  title: "Maps of Myrdae",
  description: "Live interactive map of Myrdae.",
};

const MAP_URL_FALLBACK = "https://mapeditor.suwaneegamers.net/embed-map.html";

export default function MapsOfMyrdaePage() {
  const entry = getAutoManagedPages().find((p) => p.path === "/maps-of-myrdae");
  const src = entry?.sourceUrl || MAP_URL_FALLBACK;

  return (
    <div className="h-[calc(100vh-4rem)] w-full">
      <iframe
        src={src}
        title="Interactive map of Myrdae"
        className="h-full w-full"
        style={{ border: "none", background: "#07101d" }}
        allowFullScreen
      />
    </div>
  );
}
