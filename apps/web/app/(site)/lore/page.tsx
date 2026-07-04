import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import Image from "next/image";
import { LoreFolds, type LoreBlock, type LoreEntry, type LoreInline } from "./LoreFolds";
import { getAutoManagedPages, googleDocExportUrl } from "@/lib/autoManagedPagesData";

const LORE_CACHE_PATH = path.join(process.cwd(), "..", "..", "content", "lore-doc-cache.html");

export const metadata: Metadata = {
  title: "Legends & Lore",
  description: "Myrdae legends, myths, prophecies, and archived lore entries.",
};

function getLoreDocExportUrl(): string | null {
  const entry = getAutoManagedPages().find((p) => p.path === "/lore");
  return entry?.sourceUrl ? googleDocExportUrl(entry.sourceUrl) : null;
}

export const revalidate = 3600;

const knownLoreImages = [
  {
    title: "Betrayal of Amriel",
    image: "/images/guides-to-myrdae/reference-cards/campaign-setting-faith-beliefs.webp",
  },
  {
    title: "Blood Wars Arrive",
    image: "/images/guides-to-myrdae/reference-cards/campaign-setting-time-history.webp",
  },
  {
    title: "The Forging of Dwarves",
    image: "/images/guides-to-myrdae/reference-cards/campaign-setting-species.webp",
  },
  {
    title: "Prophecy of the Year of Rising",
    image: "/images/guides-to-myrdae/reference-cards/campaign-setting-glossary.webp",
  },
  {
    title: "Layeth & Brault - Torn Apart",
    image: "/images/guides-to-myrdae/reference-cards/campaign-setting-settlements.webp",
  },
  {
    title: "Dwarves of Dunduar",
    image: "/images/guides-to-myrdae/reference-cards/campaign-setting-species.webp",
  },
  {
    title: "Rise of the Ardent One",
    image: "/images/guides-to-myrdae/reference-cards/campaign-setting-classes.webp",
  },
  {
    title: "Oldport & the Smiling Duchess",
    image: "/images/guides-to-myrdae/reference-cards/campaign-setting-the-land.webp",
  },
  {
    title: "The Laztyr & Suthrin",
    image: "/images/guides-to-myrdae/reference-cards/campaign-setting-territories.webp",
  },
  {
    title: "Year of Fending Heroes",
    image: "/images/guides-to-myrdae/reference-cards/campaign-setting-glossary.webp",
  },
];

const knownLoreTitles = [
  "Betrayal of Amriel",
  "Blood Wars Arrive",
  "The Forging of Dwarves",
  "Prophecy of the Year of Rising",
  "Layeth & Brault - Torn Apart",
  "Dwarves of Dunduar",
  "Rise of the Ardent One",
  "Oldport & the Smiling Duchess",
  "The Laztyr & Suthrin",
  "Year of Fending Heroes",
];

const fallbackLoreImages = knownLoreImages.map((source) => source.image);
const knownLoreImageByTitle = new Map(
  knownLoreImages.map((source) => [source.title, source.image]),
);

interface ExtractedLoreSection {
  title: string;
  body: string;
  blocks?: LoreBlock[];
}

function isLikelyLoreTitle(line: string) {
  const title = line.trim();
  if (title.length < 3 || title.length > 120) return false;
  if (/^legends\s*&?\s*lore$/i.test(title)) return false;
  if (/^table of contents$/i.test(title)) return false;
  if (/^page \d+/i.test(title)) return false;
  return true;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtml(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "...",
    ldquo: "\"",
    lsquo: "'",
    lt: "<",
    mdash: "-",
    nbsp: " ",
    ndash: "-",
    Ograve: "O",
    quot: "\"",
    rdquo: "\"",
    rsquo: "'",
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-zA-Z]+);/g, (entity, code: string) => {
    if (code.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    }
    return namedEntities[code] ?? entity;
  });
}

function getInnerHtml(html: string) {
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return body ? body[1] : html;
}

function textFromHtml(html: string) {
  return decodeHtml(html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ")).trim();
}

function parseClassStyles(html: string) {
  const styles = new Map<string, { bold?: boolean; italic?: boolean }>();
  const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html);
  const styleText = styleMatch?.[1] ?? "";

  for (const match of styleText.matchAll(/\.([\w-]+)\{([^}]+)\}/g)) {
    const [, className, declarations] = match;
    styles.set(className, {
      bold: /font-weight:\s*(700|bold)/i.test(declarations),
      italic: /font-style:\s*italic/i.test(declarations),
    });
  }

  return styles;
}

function parseClassAttribute(tag: string) {
  const match = /\bclass=(["'])(.*?)\1/i.exec(tag);
  return match ? match[2].split(/\s+/).filter(Boolean) : [];
}

function parseInlines(
  html: string,
  classStyles: Map<string, { bold?: boolean; italic?: boolean }>,
): LoreInline[] {
  const inlines: LoreInline[] = [];
  const stack: Array<{ bold?: boolean; italic?: boolean }> = [];
  const tokens = html.split(/(<[^>]+>)/g).filter(Boolean);

  for (const token of tokens) {
    if (token.startsWith("<")) {
      if (/^<\//.test(token)) {
        stack.pop();
        continue;
      }

      const tagName = /^<\s*([a-z0-9]+)/i.exec(token)?.[1]?.toLowerCase();
      const style = {
        bold: tagName === "b" || tagName === "strong",
        italic: tagName === "i" || tagName === "em",
      };

      for (const className of parseClassAttribute(token)) {
        const classStyle = classStyles.get(className);
        if (classStyle?.bold) style.bold = true;
        if (classStyle?.italic) style.italic = true;
      }

      if (!/\/>$/.test(token) && tagName && tagName !== "br") {
        stack.push(style);
      }
      continue;
    }

    const text = decodeHtml(token).replace(/\s+/g, " ");
    if (!text.trim()) continue;

    const active = stack.reduce(
      (state, item) => ({
        bold: state.bold || item.bold,
        italic: state.italic || item.italic,
      }),
      { bold: false, italic: false },
    );

    const previous = inlines[inlines.length - 1];
    if (previous && previous.bold === active.bold && previous.italic === active.italic) {
      previous.text += text;
    } else {
      inlines.push({
        text,
        bold: active.bold || undefined,
        italic: active.italic || undefined,
      });
    }
  }

  return inlines.map((inline, index) => {
    const text =
      index === 0 ? inline.text.trimStart() : inline.text;
    return {
      ...inline,
      text: index === inlines.length - 1 ? text.trimEnd() : text,
    };
  }).filter((inline) => inline.text);
}

function blocksToPlainText(blocks: LoreBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "list") {
        return block.items.map((item) => item.map((inline) => inline.text).join("")).join("\n");
      }
      return block.inlines.map((inline) => inline.text).join("");
    })
    .filter(Boolean)
    .join("\n");
}

function extractLoreSectionsFromHtml(html: string): ExtractedLoreSection[] {
  const classStyles = parseClassStyles(html);
  const body = getInnerHtml(html);
  const blockPattern = /<(h1|h2|p|ul)\b[^>]*>[\s\S]*?<\/\1>/gi;
  const sections: ExtractedLoreSection[] = [];
  let current: { title: string; blocks: LoreBlock[] } | null = null;

  for (const match of body.matchAll(blockPattern)) {
    const tag = match[1].toLowerCase();
    const blockHtml = match[0];

    if (tag === "h1") {
      const title = textFromHtml(blockHtml);
      if (!isLikelyLoreTitle(title)) continue;

      if (current) {
        sections.push({
          title: current.title,
          body: blocksToPlainText(current.blocks),
          blocks: current.blocks,
        });
      }
      current = { title, blocks: [] };
      continue;
    }

    if (!current) continue;

    if (tag === "h2") {
      const inlines = parseInlines(blockHtml.replace(/^<h2\b[^>]*>|<\/h2>$/gi, ""), classStyles);
      if (inlines.length) {
        current.blocks.push({ type: "subheading", inlines });
      }
      continue;
    }

    if (tag === "ul") {
      const items = [...blockHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((item) => parseInlines(item[1], classStyles))
        .filter((item) => item.length);
      if (items.length) {
        current.blocks.push({ type: "list", items });
      }
      continue;
    }

    const inlines = parseInlines(blockHtml.replace(/^<p\b[^>]*>|<\/p>$/gi, ""), classStyles);
    if (inlines.length) {
      current.blocks.push({ type: "paragraph", inlines });
    }
  }

  if (current) {
    sections.push({
      title: current.title,
      body: blocksToPlainText(current.blocks),
      blocks: current.blocks,
    });
  }

  return sections;
}

function extractLoreSectionsFromText(text: string): ExtractedLoreSection[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const startMarker = "\n________________\nBetrayal of Amriel\n";
  const contentStart = normalized.indexOf(startMarker);
  const content = contentStart >= 0 ? normalized.slice(contentStart) : normalized;
  const headings = new Map<
    string,
    { title: string; titleStart: number; bodyStart: number }
  >();

  for (const title of knownLoreTitles) {
    const match = new RegExp(`(?:^|\\n)${escapeRegExp(title)}\\n`).exec(content);
    if (!match) continue;

    const titleStart = match.index + (match[0].startsWith("\n") ? 1 : 0);
    headings.set(title, {
      title,
      titleStart,
      bodyStart: titleStart + title.length + 1,
    });
  }

  const separatorHeadingPattern = /(?:^|\n)_{8,}\n(?:\n)*([^\n]+)\n/g;
  for (const match of content.matchAll(separatorHeadingPattern)) {
    const title = match[1].trim();
    if (!isLikelyLoreTitle(title)) continue;

    const titleStart = match.index + match[0].lastIndexOf(match[1]);
    const current = headings.get(title);
    if (current && current.titleStart <= titleStart) continue;

    headings.set(title, {
      title,
      titleStart,
      bodyStart: titleStart + title.length + 1,
    });
  }

  const sortedHeadings = [...headings.values()].sort(
    (left, right) => left.titleStart - right.titleStart,
  );

  return sortedHeadings.map((heading, index) => {
    const next = sortedHeadings[index + 1];
    return {
      title: heading.title,
      body: content
        .slice(heading.bodyStart, next ? next.titleStart : content.length)
        .replace(/\n_{8,}\s*$/, "")
        .trim(),
    };
  });
}

function getSummary(body: string) {
  const firstParagraph = body
    .split(/\n{2,}|\n(?=[A-Z][^\n]{0,80}$)/)
    .find((paragraph) => paragraph.trim() && !paragraph.trim().startsWith("*"));

  if (!firstParagraph) return "A lore entry from the archived Legends & Lore collection.";

  const summary = firstParagraph.trim().replace(/\s+/g, " ");
  return summary.length > 190 ? `${summary.slice(0, 187).trim()}...` : summary;
}

function readLoreDocFromCache(): string | null {
  try {
    return fs.readFileSync(LORE_CACHE_PATH, "utf-8");
  } catch {
    return null;
  }
}

async function getLoreEntries(): Promise<LoreEntry[]> {
  let sections: ExtractedLoreSection[] = [];

  const cached = readLoreDocFromCache();
  if (cached) {
    sections = extractLoreSectionsFromHtml(cached);
    if (sections.length === 0) sections = extractLoreSectionsFromText(cached);
  }

  if (sections.length === 0) {
    const exportUrl = getLoreDocExportUrl();
    if (exportUrl) {
      try {
        const response = await fetch(exportUrl, { cache: "no-store" });
        if (response.ok) {
          const docHtml = await response.text();
          sections = extractLoreSectionsFromHtml(docHtml);
          if (sections.length === 0) {
            sections = extractLoreSectionsFromText(docHtml);
          }
        }
      } catch {
        sections = [];
      }
    }
  }

  const sources: ExtractedLoreSection[] =
    sections.length > 0
      ? sections
      : knownLoreImages.map((source) => ({
          title: source.title,
          body: "",
        }));

  return sources.map((source, index) => {
    const image =
      knownLoreImageByTitle.get(source.title) ??
      fallbackLoreImages[index % fallbackLoreImages.length];

    return {
      title: source.title,
      image,
      body: source.body,
      bodyBlocks: source.blocks,
      summary: getSummary(source.body),
    };
  });
}

export default async function LorePage() {
  const loreEntries = await getLoreEntries();

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        aria-hidden="true"
        style={{
          backgroundImage:
            'url("/images/guides-to-myrdae/reference-cards/campaign-setting-glossary.webp")',
        }}
      />
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.84) 0%, rgba(8,5,15,0.68) 38%, rgba(8,5,15,0.96) 100%), linear-gradient(90deg, rgba(8,5,15,0.74), rgba(8,5,15,0.36), rgba(8,5,15,0.72))",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <header className="mb-10 text-center">
          <h1 className="font-cinzel mb-4 text-4xl uppercase tracking-widest shimmer-text">
            Legends & Lore
          </h1>
          <p
            className="mx-auto max-w-2xl"
            style={{
              color: "#f3ead7",
              textShadow: "0 2px 18px rgba(0,0,0,0.75)",
            }}
          >
            Myths, prophecies, cultural records, and old tales preserved from the
            original Suwanee Gamers Legends & Lore archive.
          </p>
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            Click a lore entry below to expand its details.
          </p>
        </header>

        <LoreFolds entries={loreEntries} />
      </div>
    </div>
  );
}
