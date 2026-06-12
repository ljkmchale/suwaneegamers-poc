"use client";

import { useState } from "react";
import Image from "next/image";
import type { PantheonDeity } from "@/lib/pantheon";

type DetailSegment =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "ordered"; items: string[] };

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function parseDetails(details: string): DetailSegment[] {
  const segments: DetailSegment[] = [];
  const lines = details.split("\n");
  let i = 0;

  const isHeading = (line: string) => /^####\s+/.test(line.trim());
  const isBullet = (line: string) => /^[-*]\s+/.test(line.trim());
  const isOrdered = (line: string) => /^\d+\.\s+/.test(line.trim());

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    if (isHeading(line)) {
      segments.push({ kind: "heading", text: stripMarkdown(line.replace(/^####\s+/, "")) });
      i++;
      continue;
    }

    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(stripMarkdown(lines[i].trim().replace(/^[-*]\s+/, "")));
        i++;
      }
      segments.push({ kind: "bullets", items });
      continue;
    }

    if (isOrdered(line)) {
      const items: string[] = [];
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(stripMarkdown(lines[i].trim().replace(/^\d+\.\s+/, "")));
        i++;
      }
      segments.push({ kind: "ordered", items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isHeading(lines[i]) &&
      !isBullet(lines[i]) &&
      !isOrdered(lines[i])
    ) {
      paragraph.push(stripMarkdown(lines[i]));
      i++;
    }
    segments.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return segments;
}

function PantheonDetails({ details }: { details: string }) {
  const segments = parseDetails(details);

  return (
    <div className="space-y-4">
      {segments.map((segment, index) => {
        if (segment.kind === "heading") {
          return (
            <h3
              key={index}
              className="font-cinzel pt-2 text-sm uppercase tracking-[0.24em]"
              style={{ color: "var(--color-accent-gold)" }}
            >
              {segment.text}
            </h3>
          );
        }

        if (segment.kind === "bullets") {
          return (
            <ul key={index} className="space-y-1.5 pl-1">
              {segment.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className="flex gap-2 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <span style={{ color: "var(--color-accent-arcane)" }} aria-hidden="true">
                    -
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (segment.kind === "ordered") {
          return (
            <ol
              key={index}
              className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {segment.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ol>
          );
        }

        return (
          <p
            key={index}
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {segment.text}
          </p>
        );
      })}
    </div>
  );
}

function PantheonFold({ deity }: { deity: PantheonDeity }) {
  const [isOpen, setIsOpen] = useState(false);
  const displayTitle = deity.title ? `${deity.name}, ${deity.title}` : deity.name;

  return (
    <section className="py-2">
      <div className="fantasy-card overflow-hidden">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="grid w-full cursor-pointer overflow-hidden text-left sm:grid-cols-[13rem_1fr]"
        >
          <div className="relative flex min-h-28 items-center justify-center p-4 sm:min-h-full">
            {deity.image && (
              <Image
                src={deity.image}
                alt={`${deity.name} pantheon symbol`}
                width={170}
                height={170}
                className="max-h-32 w-auto object-contain"
                style={{ filter: "drop-shadow(0 0 14px rgba(139,92,246,.28))" }}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-5 px-6 py-5">
            <div className="min-w-0">
              <p
                className="font-cinzel mb-1 text-[0.65rem] uppercase tracking-[0.35em]"
                style={{ color: "var(--color-accent-arcane)" }}
              >
                {deity.domain ?? "Divine Record"}
              </p>
              <h2
                className="font-cinzel text-xl uppercase tracking-widest"
                style={{ color: "var(--color-text-primary)" }}
              >
                {displayTitle}
              </h2>
            </div>
            <span
              className="font-cinzel inline-flex shrink-0 items-center gap-2 text-xs uppercase tracking-widest"
              style={{ color: "var(--color-accent-gold)" }}
            >
              Open Details
              <span className="text-base" aria-hidden="true">
                {isOpen ? "-" : "+"}
              </span>
            </span>
          </div>
        </button>

        {isOpen && (
          <div
            className="border-t px-6 py-5"
            style={{ borderColor: "var(--color-bg-border)" }}
          >
            {deity.details ? (
              <PantheonDetails details={deity.details} />
            ) : (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                This deity is listed in the Pantheon, but no expanded source text is available yet.
              </p>
            )}

            {deity.href && (
              <a
                href={deity.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-cinzel mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-widest transition-colors hover:opacity-80"
                style={{ color: "var(--color-accent-gold)" }}
              >
                Open Full Entry
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function PantheonFolds({ deities }: { deities: PantheonDeity[] }) {
  return (
    <div className="space-y-3">
      {deities.map((deity) => (
        <PantheonFold key={deity.id} deity={deity} />
      ))}
    </div>
  );
}
