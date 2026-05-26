import fs from "fs";
import path from "path";
import Image from "next/image";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Bestiary",
  description: "Myrdae creature references migrated from the legacy Suwanee Gamers bestiary.",
};

const legacyBestiaryUrl = "https://sites.google.com/view/suwanee-gamers/bestiary";

interface Creature {
  name: string;
  type: string;
  image: string;
  href?: string;
}

function getCreatures(): Creature[] {
  const filePath = path.join(process.cwd(), "../../content/bestiary.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Creature[];
}

export default function BestiaryPage() {
  const creatures = getCreatures();
  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      <header className="mb-14 text-center">
        <p
          className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3"
          style={{ color: "var(--color-accent-arcane)" }}
        >
          Creature Archive
        </p>
        <h1 className="font-cinzel text-4xl tracking-widest uppercase mb-4 shimmer-text">
          Bestiary
        </h1>
        <p className="max-w-3xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
          Creature portraits and stat block links migrated from the legacy Suwanee Gamers bestiary.
        </p>
        <a
          href={legacyBestiaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 text-sm font-cinzel tracking-widest uppercase transition-colors hover:text-amber-400"
          style={{ color: "var(--color-accent-gold)" }}
        >
          Legacy Source
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
        </a>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {creatures.map((creature) => (
          <article key={creature.name} className="fantasy-card overflow-hidden">
            <div
              className="relative aspect-[4/3] border-b"
              style={{ borderColor: "var(--color-bg-border)" }}
            >
              <Image
                src={creature.image}
                alt={`${creature.name} bestiary illustration`}
                fill
                sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-contain p-6"
              />
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-cinzel text-2xl leading-tight" style={{ color: "var(--color-text-primary)" }}>
                    {creature.name}
                  </h2>
                  <p
                    className="mt-2 text-xs font-cinzel tracking-[0.3em] uppercase"
                    style={{ color: "var(--color-accent-arcane)" }}
                  >
                    {creature.type}
                  </p>
                </div>
              </div>

              {creature.href ? (
                <a
                  href={creature.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-cinzel tracking-widest uppercase transition-colors hover:text-amber-400"
                  style={{
                    borderColor: "var(--color-bg-border)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  Stat Block
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="mt-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  No stat block link was present on the legacy source page.
                </p>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
