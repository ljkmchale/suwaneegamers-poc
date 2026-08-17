"use client";

import { Bookmark, ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { RunicBackground } from "../calendar/RunicBackground";
import { LibraryScene } from "./LibraryScene";
import styles from "./library.module.css";

export type LibraryBook = {
  id: string;
  title: string;
  subtitle: string;
  collection: string;
  color: string;
  image?: string | null;
  pages: string[];
  sourcePath?: string;
  sourcePaths?: string[];
};

const BOOKMARK_KEY = "myrdae-library-bookmarks";

function BookReader({ book, onClose }: { book: LibraryBook; onClose: () => void }) {
  const [sourcePages, setSourcePages] = useState<string[] | null>(null);
  const [sourceError, setSourceError] = useState("");
  const [singlePage, setSinglePage] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 620px)");
    const update = () => setSinglePage(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const sourcePaths = [...new Set([book.sourcePath, ...(book.sourcePaths ?? [])].filter((value): value is string => Boolean(value)))];
    if (!sourcePaths.length) {
      setSourcePages(null);
      return;
    }
    let cancelled = false;
    setSourcePages(null);
    setSourceError("");
    Promise.all(sourcePaths.map(async (sourcePath) => {
      const response = await fetch(`/api/brain/source?${new URLSearchParams({ path: sourcePath, visibility: "players" })}`);
      const payload = await response.json() as { markdown?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "The volume could not be opened.");
      return paginateSource(payload.markdown ?? "", book.title);
    }))
      .then((sourceLeaves) => { if (!cancelled) setSourcePages(sourceLeaves.flat()); })
      .catch((error) => { if (!cancelled) setSourceError(error instanceof Error ? error.message : "The volume could not be opened."); });
    return () => { cancelled = true; };
  }, [book.sourcePath, book.sourcePaths, book.title]);

  const spreads = useMemo(() => {
    const staticPages = book.pages.length ? paginateSource(book.pages.join("\n\n"), book.title) : [];
    const hasSources = Boolean(book.sourcePath || book.sourcePaths?.length);
    const bookPages = [
      "__TITLE_PAGE__",
      ...staticPages,
      ...(hasSources ? sourcePages ?? [sourceError || "The archivists are retrieving this volume..."] : []),
    ];
    const result: Array<[string, string]> = [];
    const leavesPerView = singlePage ? 1 : 2;
    for (let index = 0; index < bookPages.length; index += leavesPerView) {
      result.push([bookPages[index] ?? "", singlePage ? "" : bookPages[index + 1] ?? ""]);
    }
    return result;
  }, [book, singlePage, sourcePages, sourceError]);
  const [spread, setSpread] = useState(0);
  const [turning, setTurning] = useState<"next" | "previous" | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(BOOKMARK_KEY) ?? "{}") as Record<string, number>;
    const savedSpread = Math.min(saved[book.id] ?? 0, spreads.length - 1);
    setSpread(savedSpread);
    setBookmarked(book.id in saved);
  }, [book.id, spreads.length]);

  function turn(direction: "next" | "previous") {
    const target = direction === "next" ? spread + 1 : spread - 1;
    if (target < 0 || target >= spreads.length || turning) return;
    setTurning(direction);
    window.setTimeout(() => {
      setSpread(target);
      setTurning(null);
    }, 360);
  }

  function saveBookmark() {
    const saved = JSON.parse(localStorage.getItem(BOOKMARK_KEY) ?? "{}") as Record<string, number>;
    saved[book.id] = spread;
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(saved));
    setBookmarked(true);
  }

  return (
    <div className={styles.readerBackdrop} role="dialog" aria-modal="true" aria-label={`Reading ${book.title}`}>
      <button className={styles.closeReader} type="button" onClick={onClose} aria-label="Return book to shelf">
        <X />
      </button>
      <div className={styles.readerHeading}>
        <span>{book.collection}</span>
        <h2>{book.title}</h2>
      </div>
      <div className={`${styles.openBook} ${singlePage ? styles.singlePageBook : ""} ${turning ? styles[turning] : ""}`}>
        <article className={styles.page}>
          <div className={styles.illuminatedBorder} aria-hidden="true" />
          {spreads[spread][0] === "__TITLE_PAGE__" ? (
            <div className={styles.titlePage}>
              <span className={styles.chapterFlourish}>❧</span>
              <small>{book.collection}</small>
              <h3>{book.title}</h3>
              {book.image && <div className={styles.bookIllustration}><Image src={book.image} alt="" fill sizes="(max-width: 700px) 42vw, 380px" /></div>}
              <p>{book.subtitle}</p>
              <span className={styles.myrdaePress}>✦ The Grand Library of Myrdae ✦</span>
            </div>
          ) : <BookPageText text={spreads[spread][0]} />}
          <span className={styles.pageNumber}>{spread * 2 + 1}</span>
        </article>
        {!singlePage && <div className={styles.binding} />}
        {!singlePage && <article className={styles.page}>
          <div className={styles.illuminatedBorder} aria-hidden="true" />
          <div className={styles.pageOrnament} aria-hidden="true">☙ ✦ ❧</div>
          <BookPageText text={spreads[spread][1]} />
          <span className={styles.pageNumber}>{spread * 2 + 2}</span>
        </article>}
        {turning && <div className={styles.turningPage} aria-hidden="true" />}
        {bookmarked && <span className={styles.ribbon} aria-label="Bookmarked page" />}
      </div>
      <div className={styles.readerControls}>
        <button type="button" onClick={() => turn("previous")} disabled={spread === 0 || Boolean(turning)}><ChevronLeft /> Previous</button>
        <button type="button" className={bookmarked ? styles.savedBookmark : ""} onClick={saveBookmark}><Bookmark /> {bookmarked ? "Ribbon placed" : "Place ribbon"}</button>
        <button type="button" onClick={() => turn("next")} disabled={spread === spreads.length - 1 || Boolean(turning)}>Next <ChevronRight /></button>
      </div>
      <p className={styles.readerProgress}>{singlePage ? `Leaf ${spread + 1} of ${spreads.length}` : `Leaves ${spread * 2 + 1}–${Math.min(spread * 2 + 2, spreads.length * 2)} of ${spreads.length * 2}`}</p>
    </div>
  );
}

function paginateSource(markdown: string, bookTitle: string): string[] {
  const clean = prepareBookText(markdown, bookTitle)
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target: string, label?: string) => label || target)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
  if (!clean) return ["This volume contains no player-safe leaves yet."];
  const paragraphs = clean.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).flatMap(splitLongPassage);
  const pages: string[] = [];
  let pageParts: string[] = [];
  let pageLength = 0;
  for (const paragraph of paragraphs) {
    if (pageParts.length && (pageLength + paragraph.length > 430 || pageParts.length >= 5)) {
      pages.push(pageParts.join("\n"));
      pageParts = [paragraph];
      pageLength = paragraph.length;
    } else {
      pageParts.push(paragraph);
      pageLength += paragraph.length;
    }
  }
  if (pageParts.length) pages.push(pageParts.join("\n"));
  return pages;
}

const NON_READER_SECTIONS = /^(source grounding|source anchors?|source notes?|sources?|reference|citation pattern|maintenance(?: rule)?|roster interpretation|audit(?: notes?| status)?|raw sources?|technical notes?|document notes?)$/i;

function prepareBookText(markdown: string, bookTitle: string): string {
  const lines = markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "").split(/\r?\n/);
  const output: string[] = [];
  let skipSection = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const headingText = heading[2].trim();
      if (heading[1].length === 1 && normalizeBookText(headingText) === normalizeBookText(bookTitle)) continue;
      if (heading[1].length <= 2) skipSection = NON_READER_SECTIONS.test(headingText);
      if (!skipSection && !/^imported notes$/i.test(headingText)) output.push(headingText);
      continue;
    }
    if (skipSection) continue;
    if (!line) {
      output.push("");
      continue;
    }
    if (/^campaign:\s*/i.test(line)) continue;
    if (/^(?:source|raw source|raw hash|imported|pulled):\s*/i.test(line)) continue;
    if (/^\|?\s*:?-{3,}/.test(line)) continue;
    if (/\b(?:fast-lookup reference|living document|update after each session|do not merge events?|do not list the players|use the .* table above when answering|generated index of wiki pages|regenerate with|raw source:|current progress is tracked|source-session evidence)\b/i.test(line)) continue;
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
      if (cells.length) output.push(cells.join(" — "));
      continue;
    }
    output.push(line.replace(/`([^`]+)`/g, "$1"));
  }
  if (/campaign player notes/i.test(bookTitle)) {
    const firstSession = output.findIndex((line) => /^\d{2}\s*[–—-]/.test(line));
    if (firstSession > 0) {
      return [...output.slice(firstSession), "", "Appendix: Party Reference", ...output.slice(0, firstSession)]
        .join("\n")
        .replace(/\n{3,}/g, "\n\n");
    }
  }
  return output.join("\n").replace(/\n{3,}/g, "\n\n");
}

function normalizeBookText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitLongPassage(passage: string): string[] {
  if (passage.length <= 280) return [passage];
  const words = passage.split(/\s+/);
  const chunks: string[] = [];
  let chunk = "";
  for (const word of words) {
    if (chunk && chunk.length + word.length + 1 > 280) {
      chunks.push(chunk);
      chunk = word;
    } else {
      chunk = chunk ? `${chunk} ${word}` : word;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function BookPageText({ text }: { text: string }) {
  return <>{text.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</>;
}

export function LibraryExperience({ books }: { books: LibraryBook[] }) {
  const [selected, setSelected] = useState<LibraryBook | null>(null);

  return (
    <div className={styles.libraryPage}>
      <RunicBackground />
      <LibraryScene books={books} onSelect={setSelected} />
      {selected && <BookReader key={selected.id} book={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
