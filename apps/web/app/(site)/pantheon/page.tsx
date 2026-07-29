import type { Metadata } from "next";
import { getPantheonDeities } from "@/lib/pantheon";
import { PantheonFolds } from "./PantheonFolds";

export const metadata: Metadata = {
  title: "Pantheon",
  description: "The gods of Myrdae with domains, rites, depictions, and commandments.",
};

export const revalidate = 86400;

export default async function PantheonPage() {
  const deities = await getPantheonDeities();

  return (
    <div className="relative min-h-screen overflow-hidden bg-black pb-20">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        aria-hidden="true"
        style={{ backgroundImage: 'url("/media/images/guides-to-myrdae/reference-cards/campaign-setting-faith-beliefs.webp")' }}
      />
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.82) 0%, rgba(8,5,15,0.72) 38%, rgba(8,5,15,0.96) 100%), linear-gradient(90deg, rgba(8,5,15,0.72), rgba(8,5,15,0.34), rgba(8,5,15,0.7))",
        }}
      />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pt-16">
        <header className="mx-auto mb-12 max-w-3xl text-center">
          <p
            className="font-cinzel text-xs uppercase tracking-[0.35em]"
            style={{ color: "var(--color-accent-arcane)" }}
          >
            Faith & Beliefs
          </p>
          <h1
            className="font-cinzel mt-3 text-4xl uppercase tracking-widest md:text-5xl"
            style={{ color: "var(--color-text-primary)" }}
          >
            Pantheon
          </h1>
          <p
            className="mt-4 text-sm leading-relaxed md:text-base"
            style={{ color: "var(--color-text-secondary)" }}
          >
            The gods of Myrdae, pulled from the campaign setting source and expanded into divine records.
          </p>
        </header>

        <PantheonFolds deities={deities} />
      </main>
    </div>
  );
}
