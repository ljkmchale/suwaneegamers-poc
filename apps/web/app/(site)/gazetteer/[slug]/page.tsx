import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getGazetteerEntries, type GazetteerEntry } from "@/lib/gazetteer";
import { getGazetteerBodyMarkdown } from "@/lib/gazetteerBody";
import { renderMarkdownLite } from "@/lib/markdownLite";

export const revalidate = 3600;

const FALLBACK_IMAGE =
  "/media/images/guides-to-myrdae/reference-cards/campaign-setting-settlements.webp";

function findEntry(slug: string): GazetteerEntry | undefined {
  return getGazetteerEntries().find((entry) => entry.slug === slug);
}

function versionHeraldryUrl(imageUrl: string): string {
  if (!imageUrl.startsWith("/media/images/gazetteer/cities/")) return imageUrl;
  try {
    const imagePath = path.join(process.cwd(), imageUrl.slice(1));
    const fingerprint = createHash("sha256").update(readFileSync(imagePath)).digest("hex").slice(0, 12);
    return `${imageUrl}?v=${fingerprint}`;
  } catch {
    return imageUrl;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = findEntry(slug);
  if (!entry) return { title: "Gazetteer" };
  return {
    title: `${entry.title} — Gazetteer`,
    description: entry.description || `A field guide to ${entry.title}.`,
  };
}

export default async function GazetteerEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = findEntry(slug);
  if (!entry) notFound();

  const markdown = getGazetteerBodyMarkdown(entry.slug);
  const bodyHtml = markdown ? renderMarkdownLite(markdown) : null;
  const sourceUrl = entry.referenceUrl ?? entry.docUrl ?? entry.folderUrl ?? null;
  const image = versionHeraldryUrl(entry.imageUrl ?? FALLBACK_IMAGE);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div className="art-bg-silver fixed inset-0 z-0" aria-hidden="true" />
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.82) 0%, rgba(8,5,15,0.9) 40%, rgba(8,5,15,0.97) 100%)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <Link
          href="/gazetteer"
          className="font-cinzel text-xs uppercase tracking-[0.3em] transition-colors hover:text-amber-400"
          style={{ color: "var(--color-accent-arcane)" }}
        >
          ← Gazetteer
        </Link>

        <header className="mt-8 flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
          <div className="relative h-[120px] w-[120px] flex-shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={`${entry.title} heraldry`}
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-cinzel shimmer-text text-4xl uppercase tracking-widest">{entry.title}</h1>
            <p className="mt-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {[entry.size ? `${entry.size} Settlement` : null, entry.region || null].filter(Boolean).join(" · ")}
            </p>
            {entry.description && (
              <p className="mt-3 max-w-2xl text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {entry.description}
              </p>
            )}
          </div>
        </header>

        <div
          className="mt-8 h-px w-full"
          style={{ background: "linear-gradient(90deg, transparent, var(--color-bg-border), transparent)" }}
        />

        {bodyHtml ? (
          <article
            className="gaz-prose mt-8"
            // Rendered by lib/markdownLite (HTML-escaped at source); safe to inject.
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <section className="fantasy-card mt-8 p-6 text-center">
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              The full write-up for {entry.title} lives in its source document.
            </p>
          </section>
        )}

        {sourceUrl && (
          <div className="mt-10 text-center">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-cinzel inline-flex w-fit rounded border px-4 py-2 text-[0.7rem] uppercase tracking-widest transition-colors hover:text-amber-400"
              style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-secondary)" }}
            >
              View source document
            </a>
          </div>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .gaz-prose { color: var(--color-text-secondary); line-height: 1.7; font-size: 0.95rem; }
        .gaz-prose h2 { font-family: var(--font-cinzel, serif); color: var(--color-accent-gold); text-transform: uppercase; letter-spacing: 0.12em; font-size: 1.3rem; margin: 2rem 0 0.75rem; }
        .gaz-prose h3 { font-family: var(--font-cinzel, serif); color: var(--color-accent-arcane); font-size: 1.1rem; margin: 1.6rem 0 0.6rem; }
        .gaz-prose h4, .gaz-prose h5, .gaz-prose h6 { color: var(--color-text-primary); font-size: 1rem; margin: 1.3rem 0 0.5rem; font-weight: 600; }
        .gaz-prose p { margin: 0.75rem 0; }
        .gaz-prose ul, .gaz-prose ol { margin: 0.75rem 0 0.75rem 1.4rem; }
        .gaz-prose li { margin: 0.35rem 0; }
        .gaz-prose ul { list-style: disc; }
        .gaz-prose ol { list-style: decimal; }
        .gaz-prose strong { color: var(--color-text-primary); }
        .gaz-prose a { color: var(--color-accent-arcane); text-decoration: underline; }
        .gaz-prose hr { border: 0; height: 1px; margin: 1.75rem 0; background: linear-gradient(90deg, transparent, var(--color-bg-border), transparent); }
        .gaz-prose blockquote { border-left: 3px solid var(--color-bg-border); padding-left: 1rem; margin: 1rem 0; color: var(--color-text-muted); font-style: italic; }
        .gaz-prose code { font-family: ui-monospace, monospace; background: var(--color-bg-card); padding: 0.1rem 0.35rem; border-radius: 3px; font-size: 0.85em; }
        .gaz-prose pre { background: var(--color-bg-card); border: 1px solid var(--color-bg-border); border-radius: 6px; padding: 0.9rem 1rem; margin: 1rem 0; overflow-x: auto; font-family: ui-monospace, monospace; font-size: 0.82rem; line-height: 1.5; white-space: pre; color: var(--color-text-secondary); }
        .gaz-table-wrap { overflow-x: auto; margin: 1rem 0; }
        .gaz-prose table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
        .gaz-prose th, .gaz-prose td { border: 1px solid var(--color-bg-border); padding: 0.4rem 0.65rem; text-align: left; vertical-align: top; }
        .gaz-prose th { background: var(--color-bg-card); color: var(--color-accent-gold); font-family: var(--font-cinzel, serif); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
        .gaz-prose tbody tr:nth-child(even) { background: rgba(255,255,255,0.02); }
      `,
        }}
      />
    </div>
  );
}
