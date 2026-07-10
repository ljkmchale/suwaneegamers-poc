import type { Metadata } from "next";
import { getHistoryData } from "@/lib/history";
import { HistorySourceView } from "./HistorySourceView";

export const metadata: Metadata = {
  title: "History",
  description: "Myrdae historical ages from the campaign setting source.",
};

export const revalidate = 86400;

export default async function HistoryPage() {
  const data = await getHistoryData();

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-black bg-cover bg-center pb-20"
      style={{ backgroundImage: 'url("/images/guides-to-myrdae/reference-cards/campaign-setting-time-history.webp")' }}
    >
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.84) 0%, rgba(8,5,15,0.74) 38%, rgba(8,5,15,0.96) 100%), linear-gradient(90deg, rgba(8,5,15,0.74), rgba(8,5,15,0.42), rgba(8,5,15,0.72))",
        }}
      />

      <main className="relative z-10 w-full pt-0">
        <HistorySourceView data={data} />
      </main>
    </div>
  );
}
