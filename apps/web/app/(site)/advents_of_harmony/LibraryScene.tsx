"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { BookOpen, Search } from "lucide-react";
import type { LibraryBook } from "./LibraryExperience";
import styles from "./library.module.css";

type Chamber = { name: string; inscription: string; collections: string[]; accent: string; kind: "chronicle" | "new-gods" | "old-gods" | "atlas"; art: string; shelfArt: string };

const CHAMBERS: Chamber[] = [
  { name: "The Living Chronicles", inscription: "Campaigns, sessions, heroes, allies, enemies, and every unfinished thread.", collections: ["Campaign Chronicles", "Chronicles Archive"], accent: "#9b4d3d", kind: "chronicle", art: "/media/images/campaigns/heroes-of-emberstran.webp", shelfArt: "/media/images/library/bookcase-chronicles-v1.webp" },
  { name: "The World Archive", inscription: "The gods, realms, peoples, relics, and accumulated lore of Myrdae.", collections: ["The New Gods", "The Old Gods", "Atlas & Gazetteer", "World Archive"], accent: "#4d7165", kind: "atlas", art: "/media/images/maps-of-myrdae/locations-map.webp", shelfArt: "/media/images/library/bookcase-cartographers-v1.webp" },
];

const FILLER_COLORS = ["#4b2624", "#263c43", "#39462b", "#5a4024", "#382b4b", "#57343c", "#2d4640", "#584d36", "#28344d", "#4b3428", "#46504d", "#63372c"];
const TITLE_COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

type CataloguedAisle = { label: string; range: string; books: LibraryBook[] };

function catalogCategory(book: LibraryBook, kind: Chamber["kind"]): string {
  const path = book.sourcePath?.toLowerCase() ?? "";
  if (kind === "chronicle") {
    if (book.collection === "Campaign Chronicles" || /\/(?:quick|summaries|timelines|indexes)\//.test(path) || /quick reference/i.test(book.title)) return "Campaigns & References";
    if (path.includes("/sessions/")) return "Session Journals";
    if (/\/(?:npcs|entities|factions)\//.test(path)) return "People & Factions";
    return "Quests, Relics & Lore";
  }
  if (book.collection === "The New Gods" || book.collection === "The Old Gods") return "Pantheon of Myrdae";
  if (book.collection === "Atlas & Gazetteer" || /\/(?:world\/locations|locations|maps)\//.test(path)) return "Atlas & Gazetteer";
  return "World Lore & Artifacts";
}

function catalogueAisles(books: LibraryBook[], kind: Chamber["kind"]): CataloguedAisle[] {
  const groups = new Map<string, LibraryBook[]>();
  for (const book of books) {
    const category = catalogCategory(book, kind);
    groups.set(category, [...(groups.get(category) ?? []), book]);
  }
  const order = kind === "chronicle"
    ? ["Campaigns & References", "Session Journals", "People & Factions", "Quests, Relics & Lore"]
    : ["Pantheon of Myrdae", "World Lore & Artifacts", "Atlas & Gazetteer"];
  return order.flatMap((label) => {
    const sorted = (groups.get(label) ?? []).sort((a, b) => {
      if (label === "Pantheon of Myrdae" && a.collection !== b.collection) return a.collection === "The New Gods" ? -1 : 1;
      return TITLE_COLLATOR.compare(a.title, b.title);
    });
    const chunkCount = Math.max(1, Math.ceil(sorted.length / 120));
    const chunkSize = Math.ceil(sorted.length / chunkCount);
    return Array.from({ length: chunkCount }, (_, index) => {
      const chunk = sorted.slice(index * chunkSize, (index + 1) * chunkSize);
      if (!chunk.length) return null;
      const first = chunk[0].title.charAt(0).toUpperCase();
      const last = chunk[chunk.length - 1].title.charAt(0).toUpperCase();
      const range = label === "Pantheon of Myrdae"
        ? `${chunk.filter((book) => book.collection === "The New Gods").length} New · ${chunk.filter((book) => book.collection === "The Old Gods").length} Old`
        : first === last ? first : `${first}–${last}`;
      return { label, range, books: chunk };
    }).filter((aisle): aisle is CataloguedAisle => Boolean(aisle));
  });
}

function hash(value: string): number {
  return Array.from(value).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function spineTitle(title: string): string {
  const condensed = title
    .replace(/^Dungeons III Session\s+(\d+)\s*-\s*/i, "DIII $1 · ")
    .replace(/^HoE Session\s+(\d+)\s*-\s*/i, "HoE $1 · ")
    .replace(/^WB Session\s+(\d+)\s*-\s*/i, "WB $1 · ")
    .replace(/^Session\s+([\d.]+)\s*-\s*/i, "$1 · ")
    .replace(/\s+Quick Reference$/i, " Reference")
    .trim();
  return condensed.length <= 25 ? condensed : `${condensed.slice(0, 24).trimEnd()}…`;
}

function BookSpine({ book, seed, withdrawing, onWithdraw }: { book?: LibraryBook; seed: string; withdrawing: boolean; onWithdraw: (book: LibraryBook) => void }) {
  const [showPreviewArt, setShowPreviewArt] = useState(false);
  const value = hash(seed);
  const artIndex = (value % 12) + 1;
  const variants = [styles.tome, styles.journal, styles.grimoire, styles.clothbound, styles.metalbound];
  const variant = variants[value % variants.length];
  const mark = book?.collection === "Campaign Chronicles" ? "⚔" : book?.collection === "The New Gods" ? "✦" : book?.collection === "The Old Gods" ? "◐" : "✥";
  const important = Boolean(book && value % 4 === 0);
  const spineStyle = {
    "--spine-height": `${76 + (value % 21)}%`,
    "--spine-width": `${25 + ((value >> 4) % 14)}px`,
    "--spine-lean": "0deg",
    "--spine-color": book?.color ?? FILLER_COLORS[value % FILLER_COLORS.length],
    "--spine-wear": `${0.08 + (value % 4) * 0.035}`,
    "--book-art": `url("/media/images/library/fantasy-book-spine-${String(artIndex).padStart(2, "0")}-v1.webp")`,
  } as CSSProperties;
  if (!book) return <span className={`${styles.fillerBook} ${variant}`} style={spineStyle} aria-hidden="true"><b /></span>;

  return (
    <button type="button" className={`${styles.realBook} ${variant} ${important ? styles.importantBook : ""} ${withdrawing ? styles.withdrawing : ""}`} style={spineStyle} onMouseEnter={() => setShowPreviewArt(true)} onFocus={() => setShowPreviewArt(true)} onClick={() => onWithdraw(book)} disabled={withdrawing} aria-label={`Take ${book.title} from the shelf`}>
      <span className={styles.spineMark} aria-hidden="true">{mark}</span>
      <span className={styles.spineTitle} title={book.title}>{spineTitle(book.title)}</span>
      <span className={styles.spineBands} aria-hidden="true" />
      <span className={styles.hoverPlaque}>{showPreviewArt && book.image && <span className={styles.plaqueArt} style={{ backgroundImage: `url("${book.image}")` }} />}<strong>{book.title}</strong><small>{book.subtitle}</small><em><BookOpen size={13} /> Examine volume</em></span>
    </button>
  );
}

function ShelfRow({ books, chamberIndex, bayIndex, rowIndex, withdrawingId, onWithdraw }: { books: LibraryBook[]; chamberIndex: number; bayIndex: number; rowIndex: number; withdrawingId: string | null; onWithdraw: (book: LibraryBook) => void }) {
  const cells = useMemo(() => {
    const assigned = [...books];
    const occupied = new Map(assigned.map((book, index) => [Math.min(9, Math.floor(((index + 0.5) * 10) / assigned.length)), book]));
    return Array.from({ length: 10 }, (_, index) => ({
      book: occupied.get(index),
      seed: `${chamberIndex}-${bayIndex}-${rowIndex}-${index}`,
      decorative: assigned.length === 0 && [0, 1, 3, 4, 6, 7, 9].includes(index),
    }));
  }, [books, chamberIndex, bayIndex, rowIndex]);
  return <div className={styles.shelfRow}><div className={styles.booksOnShelf}>{cells.map(({ book, seed, decorative }) => book || decorative ? <BookSpine key={book?.id ?? seed} book={book} seed={book?.id ?? seed} withdrawing={book?.id === withdrawingId} onWithdraw={onWithdraw} /> : <span key={seed} className={styles.shelfGap} aria-hidden="true" />)}</div></div>;
}

function CabinetBay({ books, chamberIndex, bayIndex, withdrawingId, onWithdraw }: { books: LibraryBook[]; chamberIndex: number; bayIndex: number; withdrawingId: string | null; onWithdraw: (book: LibraryBook) => void }) {
  const rowSize = Math.ceil(books.length / 4);
  return <div className={styles.cabinetBay}>{[0, 1, 2, 3].map((rowIndex) => <ShelfRow key={rowIndex} books={books.slice(rowIndex * rowSize, (rowIndex + 1) * rowSize)} chamberIndex={chamberIndex} bayIndex={bayIndex} rowIndex={rowIndex} withdrawingId={withdrawingId} onWithdraw={onWithdraw} />)}</div>;
}

function LibraryAisle({ chamber, chamberIndex, aisleIndex, catalogue, archiveSize, withdrawingId, onWithdraw, eager = false }: { chamber: Chamber; chamberIndex: number; aisleIndex: number; catalogue: CataloguedAisle; archiveSize: number; withdrawingId: string | null; onWithdraw: (book: LibraryBook) => void; eager?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(eager);

  useEffect(() => {
    if (isNearViewport || !containerRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setIsNearViewport(true);
      observer.disconnect();
    }, { rootMargin: "900px 0px" });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isNearViewport]);

  const bayBooks = useMemo(() => [
    catalogue.books.slice(0, Math.ceil(catalogue.books.length / 3)),
    catalogue.books.slice(Math.ceil(catalogue.books.length / 3), Math.ceil(catalogue.books.length / 3) * 2),
    catalogue.books.slice(Math.ceil(catalogue.books.length / 3) * 2),
  ], [catalogue.books]);
  const shelfSize = catalogue.books.length <= 45 ? styles.compactShelf : catalogue.books.length <= 80 ? styles.mediumShelf : "";

  return <div className={styles.aisle} ref={containerRef}>
    <div className={`${styles.libraryWall} ${shelfSize}`}>
      <p className={styles.aisleMarker}><span>Aisle {String(aisleIndex + 1).padStart(2, "0")}<strong>{catalogue.label}</strong></span><em>{catalogue.range}</em><b className={styles.aisleCount}>{catalogue.books.length} volumes <small>· {archiveSize} in this archive</small></b></p>
      {isNearViewport
        ? <div className={styles.cabinets} style={{ "--shelf-art": `url("${chamber.shelfArt}")` } as CSSProperties}>{bayBooks.map((bay, bayIndex) => <CabinetBay key={bayIndex} books={bay} chamberIndex={(chamberIndex * 100) + aisleIndex} bayIndex={bayIndex} withdrawingId={withdrawingId} onWithdraw={onWithdraw} />)}</div>
        : <div className={styles.lazyAislePlaceholder} aria-hidden="true" />}
    </div>
    {isNearViewport && <div className={styles.parquetFloor} aria-hidden="true" />}
  </div>;
}

function LibraryChamber({ chamber, index, books, withdrawingId, onWithdraw }: { chamber: Chamber; index: number; books: LibraryBook[]; withdrawingId: string | null; onWithdraw: (book: LibraryBook) => void }) {
  const aisles = useMemo(() => catalogueAisles(books, chamber.kind), [books, chamber.kind]);
  return (
    <section className={`${styles.chamber} ${styles[chamber.kind]}`} style={{ "--chamber-accent": chamber.accent } as CSSProperties} aria-labelledby={`chamber-${index}`}>
      <div className={styles.ceilingCoffer} aria-hidden="true"><span /><span /><span /><span /><span /></div>
      <header className={styles.chamberHeading}><div className={styles.galleryArtwork} style={{ backgroundImage: `linear-gradient(90deg, #0d0806, transparent 28% 72%, #0d0806), linear-gradient(0deg, #0d0806, transparent 45%, #0d0806), url("${chamber.art}")` }} aria-hidden="true" /><div className={styles.galleryTitle}><span>Gallery {String(index + 1).padStart(2, "0")}</span><h2 id={`chamber-${index}`}>{chamber.name}</h2><p>{chamber.inscription}</p></div></header>
      {aisles.map((catalogue, aisleIndex) => <LibraryAisle key={`${chamber.kind}-${catalogue.label}-${catalogue.range}`} chamber={chamber} chamberIndex={index} aisleIndex={aisleIndex} catalogue={catalogue} archiveSize={books.length} withdrawingId={withdrawingId} onWithdraw={onWithdraw} eager={index === 0 && aisleIndex === 0} />)}
    </section>
  );
}

function CardCatalog({ books, onSelect }: { books: LibraryBook[]; onSelect: (book: LibraryBook) => void }) {
  const [query, setQuery] = useState("");
  const [wing, setWing] = useState<"all" | "chronicles" | "world">("all");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return books.filter((book) => {
      const isChronicle = book.collection === "Campaign Chronicles" || book.collection === "Chronicles Archive";
      if (wing === "chronicles" && !isChronicle) return false;
      if (wing === "world" && isChronicle) return false;
      return `${book.title} ${book.subtitle} ${book.collection}`.toLowerCase().includes(needle);
    }).sort((a, b) => TITLE_COLLATOR.compare(a.title, b.title)).slice(0, 8);
  }, [books, query, wing]);
  const chronicleCount = books.filter((book) => book.collection === "Campaign Chronicles" || book.collection === "Chronicles Archive").length;

  return <section className={styles.cardCatalog} aria-labelledby="card-catalog-title">
    <div className={styles.catalogHeading}><span aria-hidden="true">☙</span><div><small>The Librarian&apos;s Index</small><h2 id="card-catalog-title">Card Catalog</h2><p>Search the archive and open the volume you seek.</p></div><span aria-hidden="true">❧</span></div>
    <div className={styles.catalogControls}>
      <label className={styles.catalogSearch}><Search size={18} aria-hidden="true" /><span className="sr-only">Search the card catalog</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, person, place, god, campaign…" /></label>
      <label className={styles.catalogWing}><span className="sr-only">Library wing</span><select value={wing} onChange={(event) => setWing(event.target.value as typeof wing)}><option value="all">Entire Library · {books.length}</option><option value="chronicles">Living Chronicles · {chronicleCount}</option><option value="world">World Archive · {books.length - chronicleCount}</option></select></label>
    </div>
    <div className={styles.catalogCards} aria-live="polite">
      {query.trim().length < 2 ? <p className={styles.catalogPrompt}>Begin typing to draw the matching catalog cards.</p> : matches.length ? matches.map((book) => <button type="button" key={book.id} className={styles.catalogCard} onClick={() => onSelect(book)}><span>{book.collection}</span><strong>{book.title}</strong><small>{book.subtitle}</small><em><BookOpen size={13} /> Open volume</em></button>) : <p className={styles.catalogPrompt}>No player-safe volume matches this search.</p>}
    </div>
    <div className={styles.catalogDrawers} aria-hidden="true"><i /><i /><i /><i /><i /></div>
  </section>;
}

export function LibraryScene({ books, onSelect }: { books: LibraryBook[]; onSelect: (book: LibraryBook) => void }) {
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [entranceState, setEntranceState] = useState<"closed" | "opening" | "revealing" | "inside" | "returning">("closed");
  const [entranceClip, setEntranceClip] = useState<0 | 1>(0);
  const transitionVideo = useRef<HTMLVideoElement | null>(null);
  const insideLibrary = entranceState === "revealing" || entranceState === "inside" || entranceState === "returning";
  useEffect(() => {
    document.body.style.overflow = insideLibrary ? "" : "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [insideLibrary]);
  useEffect(() => () => { document.body.style.cursor = "auto"; document.body.style.overflow = ""; }, []);
  useEffect(() => {
    if (entranceState !== "opening") return;
    const video = transitionVideo.current;
    if (!video) {
      setEntranceState("revealing");
      return;
    }
    video.load();
    video.currentTime = 0;
    void video.play().catch(() => setEntranceState("revealing"));
  }, [entranceClip, entranceState]);
  function openEntrance() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntranceState("inside");
      return;
    }
    setEntranceClip(0);
    void fetch("/media/images/library/advents-harmony-inside-library-v1.mp4", { cache: "force-cache" }).catch(() => undefined);
    setEntranceState("opening");
  }
  function leaveLibrary() {
    window.scrollTo({ top: 0, behavior: "auto" });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntranceState("closed");
      return;
    }
    const video = transitionVideo.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setEntranceClip(0);
    setEntranceState("returning");
  }
  function withdraw(book: LibraryBook) {
    if (withdrawingId) return;
    setWithdrawingId(book.id);
    window.setTimeout(() => { onSelect(book); setWithdrawingId(null); }, 620);
  }
  return <div className={styles.libraryJourney}>
    <section
      className={`${styles.libraryEntrance} ${entranceState === "opening" ? styles.entranceVideoPlaying : ""} ${entranceState === "revealing" ? styles.entranceDirectReveal : ""} ${entranceState === "returning" ? styles.entranceReturnReveal : ""} ${entranceState === "inside" ? styles.entranceInside : ""}`}
      aria-label="Entrance to the Grand Library of Myrdae"
      aria-hidden={entranceState !== "closed"}
      onTransitionEnd={(event) => {
        if (entranceState === "revealing" && event.propertyName === "opacity") setEntranceState("inside");
        else if (entranceState === "returning" && event.propertyName === "opacity") setEntranceState("closed");
      }}
    >
      <video
        ref={transitionVideo}
        className={styles.entranceVideo}
        src={entranceClip === 0 ? "/media/images/library/advents-harmony-entrance-flova-v2.mp4" : "/media/images/library/advents-harmony-inside-library-v1.mp4"}
        poster={entranceClip === 0 ? "/media/images/library/advents-harmony-entrance-flova-poster-v2.webp" : "/media/images/library/advents-harmony-inside-library-poster-v1.webp"}
        preload="auto"
        muted
        playsInline
        onEnded={() => entranceClip === 0 ? setEntranceClip(1) : setEntranceState("revealing")}
        onError={() => entranceClip === 0 ? setEntranceClip(1) : setEntranceState("revealing")}
        aria-hidden="true"
      />
      <h1 className="sr-only">Advents of Harmony — Knowledge &amp; Lore</h1>
      <button type="button" className={styles.enterLibrary} onClick={openEntrance} tabIndex={entranceState === "closed" ? 0 : -1}>
        <span>✦</span> Open the doors <span>✦</span>
      </button>
    </section>
    <div className={`${styles.libraryInterior} ${insideLibrary ? styles.interiorRevealed : ""}`} id="grand-library-collection">
      {entranceState === "inside" && <button type="button" className={styles.returnToEntrance} onClick={leaveLibrary}><span aria-hidden="true">✦</span> Exit the Library <span aria-hidden="true">✦</span></button>}
      <CardCatalog books={books} onSelect={onSelect} />
      {CHAMBERS.map((chamber, index) => <LibraryChamber key={chamber.name} chamber={chamber} index={index} books={books.filter((book) => chamber.collections.includes(book.collection))} withdrawingId={withdrawingId} onWithdraw={withdraw} />)}
      <footer className={styles.libraryEnd}><span>✦</span><p>The collection grows with every tale told in Myrdae.</p></footer>
    </div>
  </div>;
}
