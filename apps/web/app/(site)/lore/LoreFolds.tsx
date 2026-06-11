"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

export interface LoreEntry {
  title: string;
  summary: string;
  body: string;
  bodyBlocks?: LoreBlock[];
  image: string;
}

export type LoreInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export type LoreBlock =
  | { type: "paragraph"; inlines: LoreInline[] }
  | { type: "subheading"; inlines: LoreInline[] }
  | { type: "list"; items: LoreInline[][] };

function LoreInlineText({ inline }: { inline: LoreInline }) {
  let content = <>{inline.text}</>;

  if (inline.italic) {
    content = <em>{content}</em>;
  }

  if (inline.bold) {
    content = <strong>{content}</strong>;
  }

  return content;
}

function LoreInlines({ inlines }: { inlines: LoreInline[] }) {
  return (
    <>
      {inlines.map((inline, index) => (
        <LoreInlineText key={`${index}-${inline.text}`} inline={inline} />
      ))}
    </>
  );
}

function LoreBody({ body }: { body: string }) {
  if (!body) {
    return (
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        The source document text could not be loaded. Please try again later.
      </p>
    );
  }

  const blocks: Array<{ type: "paragraph"; text: string } | { type: "list"; items: string[] }> = [];
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.startsWith("* ")) {
      const items = [line.slice(2).trim()];
      while (lines[index + 1]?.startsWith("* ")) {
        index += 1;
        items.push(lines[index].slice(2).trim());
      }
      blocks.push({ type: "list", items });
      continue;
    }

    blocks.push({ type: "paragraph", text: line });
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === "list") {
          return (
            <ul key={index} className="space-y-1.5 pl-1">
              {block.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <span style={{ color: "var(--color-accent-arcane)" }} aria-hidden="true">
                    *
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={index}
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

function LoreRichBody({ blocks }: { blocks: LoreBlock[] }) {
  if (!blocks.length) {
    return <LoreBody body="" />;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === "subheading") {
          return (
            <h4
              key={index}
              className="font-cinzel pt-3 text-base uppercase tracking-[0.18em]"
              style={{ color: "var(--color-accent-gold)" }}
            >
              <LoreInlines inlines={block.inlines} />
            </h4>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={index} className="space-y-1.5 pl-1">
              {block.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className="flex gap-2 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <span style={{ color: "var(--color-accent-arcane)" }} aria-hidden="true">
                    *
                  </span>
                  <span>
                    <LoreInlines inlines={item} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={index}
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <LoreInlines inlines={block.inlines} />
          </p>
        );
      })}
    </div>
  );
}

function LoreFold({ entry }: { entry: LoreEntry }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="py-2">
      <div className="fantasy-card overflow-hidden">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="grid w-full cursor-pointer overflow-hidden text-left sm:grid-cols-[13rem_1fr]"
        >
          <div className="relative flex min-h-24 items-center justify-center p-4 sm:min-h-full">
            <Image
              src={entry.image}
              alt=""
              width={160}
              height={160}
              className="max-h-28 w-auto object-contain"
              style={{
                filter: "drop-shadow(0 0 14px rgba(139,92,246,.28))",
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-5 px-6 py-5">
            <div className="min-w-0">
              <p
                className="font-cinzel mb-1 text-[0.65rem] uppercase tracking-[0.35em]"
                style={{ color: "var(--color-accent-arcane)" }}
              >
                Archived Lore
              </p>
              <h2
                className="font-cinzel text-xl uppercase tracking-widest"
                style={{ color: "var(--color-text-primary)" }}
              >
                {entry.title}
              </h2>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {entry.summary}
              </p>
            </div>
            <span
              className="font-cinzel inline-flex shrink-0 items-center gap-2 text-xs uppercase tracking-widest"
              style={{ color: "var(--color-accent-gold)" }}
            >
              Open Details
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </span>
          </div>
        </button>

        {isOpen && (
          <div
            className="border-t px-6 py-5"
            style={{ borderColor: "var(--color-bg-border)" }}
          >
            <div className="space-y-4">
              <h3
                className="font-cinzel pt-2 text-sm uppercase tracking-[0.24em]"
                style={{ color: "var(--color-accent-gold)" }}
              >
                Lore Text
              </h3>
              {entry.bodyBlocks ? (
                <LoreRichBody blocks={entry.bodyBlocks} />
              ) : (
                <LoreBody body={entry.body} />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function LoreFolds({ entries }: { entries: LoreEntry[] }) {
  return (
    <section>
      <div className="mb-5">
        <p
          className="font-cinzel text-xs uppercase tracking-[0.35em]"
          style={{ color: "var(--color-accent-arcane)" }}
        >
          Legends & Lore
        </p>
        <h2
          className="font-cinzel mt-1 text-2xl"
          style={{ color: "var(--color-accent-gold)" }}
        >
          Archived Entries
        </h2>
      </div>
      {entries.map((entry) => (
        <LoreFold key={entry.title} entry={entry} />
      ))}
    </section>
  );
}
