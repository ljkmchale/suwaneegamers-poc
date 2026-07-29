import type { Metadata } from "next";
import Image from "next/image";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getGazetteerEntries, type GazetteerEntry } from "@/lib/gazetteer";

export const metadata: Metadata = {
  title: "Gazetteer",
  description: "A field guide to notable settlements across Myrdae.",
};

export const revalidate = 3600;

const FALLBACK_IMAGE =
  "/media/images/guides-to-myrdae/reference-cards/campaign-setting-settlements.webp";

const MINOR_SETTLEMENTS_REFERENCE_URL =
  "https://docs.google.com/document/d/1qY82tYJ_K6VMwEhfBZ-NvuX6WMKdSOpga3E40UzFUdE/edit?usp=sharing";

const MINOR_SETTLEMENTS_COUNT = 11;

function versionHeraldryUrl(imageUrl: string): string {
  if (!imageUrl.startsWith("/media/images/gazetteer/cities/")) return imageUrl;
  try {
    const imagePath = path.join(process.cwd(), "public", imageUrl.slice(1));
    const fingerprint = createHash("sha256")
      .update(readFileSync(imagePath))
      .digest("hex")
      .slice(0, 12);
    return `${imageUrl}?v=${fingerprint}`;
  } catch {
    return imageUrl;
  }
}

function GazetteerCard({ entry }: { entry: GazetteerEntry }) {
  const href = entry.referenceUrl ?? entry.docUrl ?? entry.folderUrl ?? "#";
  const image = versionHeraldryUrl(entry.imageUrl ?? FALLBACK_IMAGE);
  const hasRemoteHeraldry = Boolean(entry.imageUrl);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fantasy-card group grid min-h-[118px] grid-cols-[92px_minmax(0,1fr)] gap-4 overflow-hidden p-4 transition-transform duration-200 hover:-translate-y-1"
    >
      <div
        className="relative h-[92px] w-[92px] overflow-hidden"
        style={{ borderColor: "var(--color-bg-border)" }}
      >
        {hasRemoteHeraldry ? (
          // Drive image URLs should render directly; Next/Image only optimizes configured remote hosts.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={`${entry.title} heraldry`}
            className="absolute inset-0 h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <Image
            src={image}
            alt={`${entry.title} Gazetteer artwork`}
            fill
            sizes="92px"
            className="object-contain"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-center py-1">
        <h2
          className="font-cinzel truncate text-base leading-tight transition-colors group-hover:text-amber-400"
          style={{ color: "var(--color-accent-gold)" }}
        >
          {entry.title}
        </h2>
        <p
          className="mt-2 truncate text-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {entry.size ? `${entry.size} Sized` : "Settlement"}
        </p>
        {entry.region && (
          <p className="mt-2 truncate text-xs" style={{ color: "var(--color-accent-arcane)" }}>
            {entry.region}
          </p>
        )}
        <span
          className="font-cinzel mt-3 inline-flex w-fit rounded border px-3 py-1 text-[0.65rem] uppercase tracking-widest"
          style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-secondary)" }}
        >
          Reference
        </span>
      </div>
    </a>
  );
}

function MinorSettlementsCard({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fantasy-card group grid min-h-[190px] gap-6 overflow-hidden p-6 transition-transform duration-200 hover:-translate-y-1 sm:grid-cols-[180px_minmax(0,1fr)] xl:col-span-3 2xl:col-span-4"
    >
      <div className="relative min-h-[150px] overflow-hidden">
        <Image
          src={FALLBACK_IMAGE}
          alt="Minor settlements artwork"
          fill
          sizes="(min-width: 1536px) 180px, (min-width: 640px) 180px, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-col justify-center py-1">
        <p
          className="font-cinzel text-xs uppercase tracking-[0.32em]"
          style={{ color: "var(--color-accent-arcane)" }}
        >
          Living Document
        </p>
        <h2
          className="font-cinzel mt-3 text-2xl uppercase tracking-widest transition-colors group-hover:text-amber-400"
          style={{ color: "var(--color-accent-gold)" }}
        >
          Minor Settlements
        </h2>
        <p className="mt-4 max-w-3xl text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {`${MINOR_SETTLEMENTS_COUNT} minor locations are grouped here while their individual write-ups are expanded.`}
        </p>
        <span
          className="font-cinzel mt-5 inline-flex w-fit rounded border px-4 py-2 text-[0.7rem] uppercase tracking-widest"
          style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-secondary)" }}
        >
          Open Reference
        </span>
      </div>
    </a>
  );
}

export default async function GazetteerPage() {
  const entries = getGazetteerEntries();

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div className="art-bg-silver fixed inset-0 z-0" aria-hidden="true" />
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.78) 0%, rgba(8,5,15,0.68) 36%, rgba(8,5,15,0.94) 100%), linear-gradient(90deg, rgba(8,5,15,0.48), rgba(8,5,15,0.2), rgba(8,5,15,0.58))",
        }}
      />
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <header className="mb-12 text-center">
          <p
            className="font-cinzel mb-3 text-xs uppercase tracking-[0.4em]"
            style={{ color: "var(--color-accent-arcane)" }}
          >
            Settlement References
          </p>
          <h1 className="font-cinzel shimmer-text text-4xl uppercase tracking-widest">
            Gazetteer
          </h1>
          <p className="mx-auto mt-4 max-w-3xl" style={{ color: "var(--color-text-secondary)" }}>
            Details on notable settlements across Myrdae.
          </p>
        </header>

        {entries.length > 0 ? (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <MinorSettlementsCard href={MINOR_SETTLEMENTS_REFERENCE_URL} />

            {entries.map((entry) => (
              <GazetteerCard key={entry.id} entry={entry} />
            ))}
          </section>
        ) : (
          <section className="fantasy-card mx-auto max-w-2xl p-6 text-center">
            <h2
              className="font-cinzel text-xl uppercase tracking-widest"
              style={{ color: "var(--color-text-primary)" }}
            >
              No Gazetteer Entries Found
            </h2>
            <p className="mt-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              No settlement entries are available right now. Check back as the records of Myrdae expand.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
