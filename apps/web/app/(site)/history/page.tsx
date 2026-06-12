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
    <div className="relative min-h-screen overflow-hidden bg-black pb-20">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        aria-hidden="true"
        style={{ backgroundImage: 'url("/images/guides-to-myrdae/reference-cards/campaign-setting-time-history.webp")' }}
      />
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.84) 0%, rgba(8,5,15,0.74) 38%, rgba(8,5,15,0.96) 100%), linear-gradient(90deg, rgba(8,5,15,0.74), rgba(8,5,15,0.42), rgba(8,5,15,0.72))",
        }}
      />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pt-16">
        <header className="mx-auto mb-12 max-w-3xl text-center">
          <p
            className="font-cinzel text-xs uppercase tracking-[0.35em]"
            style={{ color: "var(--color-accent-arcane)" }}
          >
            Time & History
          </p>
          <h1
            className="font-cinzel mt-3 text-4xl uppercase tracking-widest md:text-5xl"
            style={{ color: "var(--color-text-primary)" }}
          >
            History
          </h1>
          <p
            className="mt-4 text-sm leading-relaxed md:text-base"
            style={{ color: "var(--color-text-secondary)" }}
          >
            The current historical ages of Myrdae, pulled from the campaign setting source.
          </p>
        </header>

        <HistorySourceView data={data} />
      </main>
    </div>
  );
}
