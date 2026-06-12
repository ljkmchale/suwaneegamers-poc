import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import Image from "next/image";
import { getAutoManagedPages, googleDocExportUrl } from "@/lib/autoManagedPagesData";

export const metadata: Metadata = {
  title: "Gazetteer",
  description: "A field guide to notable settlements across Myrdae.",
};

export const revalidate = 86400;

interface GazetteerEntry {
  name: string;
  size: string;
  coord: string;
  region: string;
  description: string;
  href: string;
  image: string;
  imageType: "heraldry" | "artwork" | "fallback";
}

const FALLBACK_IMAGE =
  "/images/guides-to-myrdae/reference-cards/campaign-setting-settlements.webp";

const MINOR_SETTLEMENTS_REFERENCE_URL =
  "https://docs.google.com/document/d/1qY82tYJ_K6VMwEhfBZ-NvuX6WMKdSOpga3E40UzFUdE/edit?usp=sharing";

const MINOR_SETTLEMENTS_COUNT = 11;

const DOCUMENTED_ENTRY_SLUGS_IN_ORDER = [
  "abbey-of-light",
  "adsuren",
  "emberstran",
  "nunglthil",
  "onaren",
  "scarwatch-hold",
  "shademoor",
];

const DOCUMENTED_ENTRY_SLUGS = new Set(DOCUMENTED_ENTRY_SLUGS_IN_ORDER);

const SUPPLEMENTAL_DOCUMENTED_ENTRIES: GazetteerEntry[] = [
  {
    name: "Nunglthil",
    href: "https://docs.google.com/document/d/1Uow9Y0-_llBAp4meZsA-QEFTmMslbMV_IlgYV3UjNxg/edit?usp=sharing",
    size: "",
    coord: "",
    region: "Underdark",
    description: "Full location write-up available.",
    image: "/images/gazetteer/cities/nunglthil.png",
    imageType: "artwork",
  },
];

function getGazetteerExportUrl() {
  const pages = getAutoManagedPages();
  const entry =
    pages.find((page) => page.path === "/gazetteer") ??
    pages.find((page) => page.path === "/campaign-setting");
  return entry?.sourceUrl ? googleDocExportUrl(entry.sourceUrl, "md") : null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cleanMarkdown(value: string) {
  return decodeEntities(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/!\[\]\[[^\]]+\]/g, "")
    .replace(/\\([*_`\-[\]()])/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string) {
  return cleanMarkdown(value)
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function withSupplementalDocumentedEntries(entries: GazetteerEntry[]) {
  const sourceSlugs = new Set(entries.map((entry) => slugify(entry.name)));
  return [
    ...entries,
    ...SUPPLEMENTAL_DOCUMENTED_ENTRIES.filter((entry) => !sourceSlugs.has(slugify(entry.name))),
  ];
}

function getImageForEntry(name: string): Pick<GazetteerEntry, "image" | "imageType"> {
  const slug = slugify(name);
  const imageDir = path.join(process.cwd(), "public", "images", "gazetteer", "cities");
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const filename = `${slug}.${ext}`;
    if (fs.existsSync(path.join(imageDir, filename))) {
      return { image: `/images/gazetteer/cities/${filename}`, imageType: "artwork" };
    }
  }
  return { image: FALLBACK_IMAGE, imageType: "fallback" };
}

function parseImageReferences(markdown: string) {
  const references = new Map<string, string>();
  for (const match of markdown.matchAll(/^\[([^\]]+)\]:\s*<?([^>\s]+)>?/gm)) {
    references.set(match[1], decodeEntities(match[2]));
  }
  return references;
}

function getHeraldryImage(markdownCell: string, imageReferences: Map<string, string>) {
  const reference = markdownCell.match(/!\[[^\]]*\]\[([^\]]+)\]/);
  if (reference) return imageReferences.get(reference[1]) ?? null;

  const inline = markdownCell.match(/!\[[^\]]*\]\(([^)]+)\)/);
  return inline ? decodeEntities(inline[1].replace(/^<|>$/g, "")) : null;
}

function parseSettlementRows(markdown: string): GazetteerEntry[] {
  const lines = markdown.split("\n");
  const imageReferences = parseImageReferences(markdown);
  const headerIndex = lines.findIndex((line) =>
    /^\|\s*Heraldry\s*\|\s*Settlement\s*\|\s*Size\s*\|\s*Coord\.\s*\|\s*Region\s*\|\s*Description\s*\|/.test(
      line.replaceAll("*", ""),
    ),
  );
  if (headerIndex < 0) return [];

  const entries: GazetteerEntry[] = [];
  const seen = new Set<string>();

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith("|")) break;
    if (/^\|[\s:|-]+\|$/.test(line)) continue;

    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 6) continue;

    const link = cells[1].match(/\[([^\]]+)\]\((https:\/\/docs\.google\.com\/document\/d\/[^)]+)\)/);
    if (!link) continue;

    const name = cleanMarkdown(link[1]);
    const key = slugify(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);

    const heraldryImage = getHeraldryImage(cells[0], imageReferences);
    const fallbackImage = getImageForEntry(name);

    entries.push({
      name,
      href: link[2],
      size: cleanMarkdown(cells[2]),
      coord: cleanMarkdown(cells[3]),
      region: cleanMarkdown(cells[4]),
      description: cleanMarkdown(cells[5]),
      image: heraldryImage ?? fallbackImage.image,
      imageType: heraldryImage ? "heraldry" : fallbackImage.imageType,
    });
  }

  return entries;
}

async function getGazetteerEntries() {
  const exportUrl = getGazetteerExportUrl();
  if (!exportUrl) return [];

  try {
    const response = await fetch(exportUrl, { next: { revalidate: 86400 } });
    if (!response.ok) return [];
    return withSupplementalDocumentedEntries(parseSettlementRows(await response.text()));
  } catch {
    return SUPPLEMENTAL_DOCUMENTED_ENTRIES;
  }
}

function GazetteerCard({ entry }: { entry: GazetteerEntry }) {
  return (
    <a
      href={entry.href}
      target="_blank"
      rel="noopener noreferrer"
      className="fantasy-card group grid min-h-[118px] grid-cols-[92px_minmax(0,1fr)] gap-4 overflow-hidden p-4 transition-transform duration-200 hover:-translate-y-1"
    >
      <div
        className="relative h-[92px] w-[92px] overflow-hidden"
        style={{ borderColor: "var(--color-bg-border)" }}
      >
        {entry.imageType === "heraldry" ? (
          // Google Docs exports table heraldry as data URLs, which Next/Image should not optimize.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.image}
            alt={`${entry.name} heraldry`}
            className="absolute inset-0 h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <Image
            src={entry.image}
            alt={`${entry.name} Gazetteer artwork`}
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
          {entry.name}
        </h2>
        <p
          className="mt-2 truncate text-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {entry.size ? `${entry.size} Sized` : "Settlement"}
        </p>
        {(entry.region || entry.coord) && (
          <p className="mt-2 truncate text-xs" style={{ color: "var(--color-accent-arcane)" }}>
            {entry.region || `Map ${entry.coord}`}
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

function SectionDivider({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="col-span-full flex items-center gap-4 pt-6">
      <div className="h-px flex-1" style={{ background: "var(--color-bg-border)" }} />
      <div className="text-center">
        <p
          className="font-cinzel text-[0.65rem] uppercase tracking-[0.32em]"
          style={{ color: "var(--color-accent-arcane)" }}
        >
          {eyebrow}
        </p>
        <h2
          className="font-cinzel mt-1 text-xl uppercase tracking-widest"
          style={{ color: "var(--color-accent-gold)" }}
        >
          {title}
        </h2>
      </div>
      <div className="h-px flex-1" style={{ background: "var(--color-bg-border)" }} />
    </div>
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
          In Progress
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
  const entries = await getGazetteerEntries();
  const minorEntries = entries.filter((entry) => !DOCUMENTED_ENTRY_SLUGS.has(slugify(entry.name)));
  const featuredEntries = entries
    .filter((entry) => DOCUMENTED_ENTRY_SLUGS.has(slugify(entry.name)))
    .sort(
      (left, right) =>
        DOCUMENTED_ENTRY_SLUGS_IN_ORDER.indexOf(slugify(left.name)) -
        DOCUMENTED_ENTRY_SLUGS_IN_ORDER.indexOf(slugify(right.name)),
    );

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
            Gazetteer
          </p>
          <h1 className="font-cinzel shimmer-text text-4xl uppercase tracking-widest">
            Gazetteer
          </h1>
          <p className="mx-auto mt-4 max-w-3xl" style={{ color: "var(--color-text-secondary)" }}>
            Browse the notable towns, ports, abbeys, keeps, and hidden enclaves recorded
            across the lands of Myrdae.
          </p>
        </header>

        {entries.length > 0 ? (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {minorEntries.length > 0 && (
              <MinorSettlementsCard href={MINOR_SETTLEMENTS_REFERENCE_URL} />
            )}

            <SectionDivider eyebrow="Ready for play" title="Documented Locations" />
            {featuredEntries.map((entry) => (
              <GazetteerCard key={entry.href} entry={entry} />
            ))}

            <SectionDivider eyebrow="In progress" title="Non-Documented Locations" />
            {minorEntries.map((entry) => (
              <GazetteerCard key={entry.href} entry={entry} />
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
