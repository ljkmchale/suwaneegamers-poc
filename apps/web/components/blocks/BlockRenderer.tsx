import fs from "fs";
import path from "path";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { HeroSection } from "@/components/fantasy/HeroSection";
import {
  listedCampaigns,
  sideCampaigns,
  findCampaign,
  normalizeCampaignTitle,
} from "@/lib/campaigns";
import { getPlayerProfiles, assignmentsForPlayer } from "@/lib/players";
import { getDungeonMasters, campaignsForDm } from "@/lib/dungeonMasters";
import { fetchUpcomingCalendarEvents, GOOGLE_CALENDAR_TIMEZONE } from "@/lib/calendar";
import type { BlockItem, CardLayoutItem, ProfileCardItem, GridSectionChild } from "@/lib/pageBlocks";
import { parseGridSectionItems } from "@/lib/pageBlocks";

// ── Helpers ───────────────────────────────────────────────────────────────────

const isExternal = (href: string) =>
  href.startsWith("http://") || href.startsWith("https://");

// ── Generic content blocks ────────────────────────────────────────────────────

function DividerBlock({ props }: { props: Record<string, unknown> }) {
  const label   = props.label   as string | undefined;
  const variant = (props.variant as string | undefined) ?? "ornate";

  if (label) {
    return (
      <div className="flex items-center gap-4 py-8 max-w-6xl mx-auto px-6">
        <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
        <span className="font-cinzel text-xs tracking-[0.35em] uppercase shrink-0"
          style={{ color: "var(--color-text-muted)" }}>
          {label}
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
      </div>
    );
  }

  if (variant === "ornate") {
    return (
      <div className="py-6 max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
          <span style={{ color: "var(--color-bg-border)", fontSize: "0.7rem" }}>✦</span>
          <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 max-w-6xl mx-auto px-6">
      <hr style={{ borderColor: "var(--color-bg-border)" }} />
    </div>
  );
}

function CardBlock({ props }: { props: Record<string, unknown> }) {
  const eyebrow     = props.eyebrow     as string | undefined;
  const title       = props.title       as string;
  const description = props.description as string | undefined;
  const href        = props.href        as string | undefined;
  const linkLabel   = props.linkLabel   as string | undefined;

  const inner = (
    <div className="fantasy-card p-6">
      {eyebrow && (
        <p className="font-cinzel text-xs tracking-[0.35em] uppercase mb-2"
          style={{ color: "var(--color-accent-arcane)" }}>{eyebrow}</p>
      )}
      <h3 className="font-cinzel text-xl tracking-wider" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </h3>
      {description && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          {description}
        </p>
      )}
      {href && linkLabel && (
        <p className="mt-4 text-xs font-cinzel tracking-widest uppercase"
          style={{ color: "var(--color-accent-gold)" }}>
          {linkLabel} →
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-4">
        {isExternal(href)
          ? <a href={href} target="_blank" rel="noopener noreferrer" className="block group">{inner}</a>
          : <Link href={href} className="block group">{inner}</Link>
        }
      </div>
    );
  }
  return <div className="max-w-6xl mx-auto px-6 py-4">{inner}</div>;
}

function ImageBlock({ props }: { props: Record<string, unknown> }) {
  const src     = props.src     as string;
  const alt     = (props.alt     as string | undefined) ?? "";
  const caption = props.caption as string | undefined;
  const size    = (props.size   as string | undefined) ?? "large";

  if (!src) return null;

  const wrapClass =
    size === "full"   ? "w-full px-0" :
    size === "medium" ? "max-w-xl mx-auto px-6" :
                        "max-w-3xl mx-auto px-6";

  return (
    <div className={`${wrapClass} py-6`}>
      <div className="relative w-full aspect-video rounded-lg overflow-hidden border"
        style={{ borderColor: "var(--color-bg-border)" }}>
        <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 75vw" />
      </div>
      {caption && (
        <p className="mt-3 text-xs text-center font-cinzel tracking-wider"
          style={{ color: "var(--color-text-muted)" }}>{caption}</p>
      )}
    </div>
  );
}

function TextBlock({ props }: { props: Record<string, unknown> }) {
  const content = props.content as string;
  const align   = (props.align as string | undefined) ?? "left";
  return (
    <div className={`max-w-3xl mx-auto px-6 py-6 ${align === "center" ? "text-center" : ""}`}>
      <p className="text-base leading-relaxed whitespace-pre-wrap"
        style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-body)" }}>
        {content}
      </p>
    </div>
  );
}

function CalloutBlock({ props }: { props: Record<string, unknown> }) {
  const title   = props.title   as string | undefined;
  const content = props.content as string;
  const href    = props.href    as string | undefined;
  const variant = (props.variant as string | undefined) ?? "gold";
  const colorVar =
    variant === "arcane" ? "var(--color-accent-arcane)" :
    variant === "blood"  ? "var(--color-accent-blood)"  :
                           "var(--color-accent-gold)";
  const isExternal = href?.startsWith("http://") || href?.startsWith("https://");

  const inner = (
    <div className="rounded-lg border-l-4 p-5 transition-opacity"
      style={{ borderColor: colorVar, background: "var(--color-bg-card)" }}>
      {title && (
        <p className="font-cinzel text-sm tracking-widest uppercase mb-2 inline-flex items-center gap-1.5"
          style={{ color: colorVar }}>
          {title}
          {href && <span className="opacity-50 text-xs">{isExternal ? "↗" : "→"}</span>}
        </p>
      )}
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{content}</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-4">
      {href
        ? isExternal
          ? <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80 transition-opacity cursor-pointer">{inner}</a>
          : <Link href={href} className="block hover:opacity-80 transition-opacity">{inner}</Link>
        : inner
      }
    </div>
  );
}

function SpacerBlock({ props }: { props: Record<string, unknown> }) {
  const size = (props.size as string | undefined) ?? "md";
  const h = size === "sm" ? "h-8" : size === "lg" ? "h-24" : "h-16";
  return <div className={h} aria-hidden="true" />;
}

function QuoteBlock({ props }: { props: Record<string, unknown> }) {
  const text        = (props.text          as string | undefined) ?? "";
  const attribution = props.attribution   as string | undefined;
  const variant     = (props.variant       as string | undefined) ?? "gold";
  const colorVar =
    variant === "arcane" ? "var(--color-accent-arcane)" :
    variant === "muted"  ? "var(--color-text-muted)"    :
                           "var(--color-accent-gold)";

  if (!text) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <blockquote className="relative pl-6 border-l-4" style={{ borderColor: colorVar }}>
        <p
          className="font-cinzel text-xl leading-relaxed italic"
          style={{ color: "var(--color-text-primary)", textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}
        >
          ❝{text}❞
        </p>
        {attribution && (
          <footer className="mt-3 text-sm font-cinzel tracking-widest" style={{ color: colorVar }}>
            {attribution}
          </footer>
        )}
      </blockquote>
    </div>
  );
}

function CardGridBlock({
  props,
  children,
}: {
  props: Record<string, unknown>;
  children?: ReactNode;
}) {
  const columns = (props.columns as string | undefined) ?? "2";
  const gap = (props.gap as string | undefined) ?? "md";
  const columnClass = columns === "3" ? "sm:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2";
  const gapClass = gap === "sm" ? "gap-3" : gap === "lg" ? "gap-8" : "gap-5";

  return (
    <section className="max-w-6xl mx-auto px-6 py-8">
      <div className={`grid grid-cols-1 ${columnClass} ${gapClass}`}>
        {children}
      </div>
    </section>
  );
}

// ── Layout blocks ─────────────────────────────────────────────────────────────

function PageHeaderBlock({ props }: { props: Record<string, unknown> }) {
  const eyebrow     = props.eyebrow     as string | undefined;
  const title       = props.title       as string | undefined;
  const description = props.description as string | undefined;
  const align       = (props.align as string | undefined) ?? "center";
  const cls = align === "center" ? "text-center" : "";

  return (
    <header className={`mb-14 max-w-6xl mx-auto px-6 pt-8 ${cls}`}>
      {eyebrow && (
        <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3"
          style={{ color: "var(--color-accent-arcane)" }}>{eyebrow}</p>
      )}
      {title && (
        <h1 className="font-cinzel text-4xl tracking-widest uppercase mb-4 shimmer-text">{title}</h1>
      )}
      {description && (
        <p className={`${align === "center" ? "max-w-2xl mx-auto" : "max-w-3xl"}`}
          style={{ color: "var(--color-text-secondary)" }}>{description}</p>
      )}
    </header>
  );
}


interface PortalLinkData {
  title: string;
  description?: string;
  href: string;
  label?: string;
}

interface ListLinkData {
  label: string;
  href: string;
  description?: string;
}

interface GalleryImageData {
  src: string;
  alt?: string;
  caption?: string;
}

interface SavedCharacterData {
  name?: string;
  campaign?: string;
  dm?: string;
  url?: string;
}

interface SavedEntryData {
  title?: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  url?: string;
}

function parseJsonArray<T>(raw: unknown): T[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function savedCharactersFromItem(item: ProfileCardItem): SavedCharacterData[] {
  const saved = parseJsonArray<SavedCharacterData>(item.props.characters);
  if (saved.length > 0) return saved;

  const playerName = (item.props.playerName as string) ?? "";
  if (!playerName) return [];

  return assignmentsForPlayer(playerName).map(({ character, campaign }) => ({
    name: character.name,
    campaign: campaign.name,
    dm: campaign.dm,
    url: character.url,
  }));
}

function PortalLinksBlock({ props }: { props: Record<string, unknown> }) {
  const eyebrow     = props.eyebrow     as string | undefined;
  const title       = props.title       as string | undefined;
  const description = props.description as string | undefined;
  const raw         = props.links       as string | undefined;

  let links = parseJsonArray<PortalLinkData>(raw);
  try { links = raw ? JSON.parse(raw) : []; } catch { /* malformed JSON — skip */ }

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      {(eyebrow || title || description) && (
        <div className="text-center mb-10">
          {eyebrow && (
            <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-2"
              style={{ color: "var(--color-accent-arcane)" }}>{eyebrow}</p>
          )}
          {title && (
            <h2 className="font-cinzel text-2xl tracking-widest uppercase mb-3 shimmer-text">{title}</h2>
          )}
          {description && (
            <p className="max-w-xl mx-auto text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {description}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {links.map((link, i) => {
          const ext = isExternal(link.href);
          const inner = (
            <div className="fantasy-card p-5 block group h-full">
              <h3 className="font-cinzel text-base mb-3" style={{ color: "var(--color-accent-gold)" }}>
                {link.title}
              </h3>
              {link.description && (
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--color-text-secondary)" }}>
                  {link.description}
                </p>
              )}
              {link.label && (
                <span className="text-xs font-cinzel tracking-widest uppercase"
                  style={{ color: "var(--color-text-muted)" }}>
                  {link.label} {ext ? "↗" : "→"}
                </span>
              )}
            </div>
          );
          return ext
            ? <a key={i} href={link.href} target="_blank" rel="noopener noreferrer">{inner}</a>
            : <Link key={i} href={link.href}>{inner}</Link>;
        })}
      </div>
    </section>
  );
}

function SectionHeadingBlock({ props }: { props: Record<string, unknown> }) {
  const eyebrow = props.eyebrow as string | undefined;
  const title = props.title as string | undefined;
  const description = props.description as string | undefined;
  const align = (props.align as string | undefined) ?? "left";
  const textAlign = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  const descMargin = align === "center" ? "max-w-2xl mx-auto" : align === "right" ? "max-w-2xl ml-auto" : "max-w-3xl";

  return (
    <section className={`max-w-6xl mx-auto px-6 py-10 ${textAlign}`}>
      {eyebrow && (
        <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-2"
          style={{ color: "var(--color-accent-arcane)" }}>{eyebrow}</p>
      )}
      {title && (
        <h2 className="font-cinzel text-3xl tracking-widest uppercase mb-3 shimmer-text">{title}</h2>
      )}
      {description && (
        <p className={`text-sm leading-relaxed ${descMargin}`}
          style={{ color: "var(--color-text-secondary)" }}>{description}</p>
      )}
    </section>
  );
}

function ButtonLinkBlock({ props }: { props: Record<string, unknown> }) {
  const label = (props.label as string | undefined) ?? "Open Link";
  const href = (props.href as string | undefined) ?? "";
  const align = (props.align as string | undefined) ?? "left";
  const variant = (props.variant as string | undefined) ?? "primary";
  const justify =
    align === "center" ? "justify-center" :
    align === "right" ? "justify-end" :
    "justify-start";
  const className =
    variant === "secondary"
      ? "inline-flex items-center rounded-md border px-4 py-2 text-xs font-cinzel tracking-widest uppercase transition-colors hover:text-amber-400"
      : "inline-flex items-center rounded-md px-4 py-2 text-xs font-cinzel tracking-widest uppercase transition-colors hover:brightness-110";
  const style =
    variant === "secondary"
      ? { borderColor: "var(--color-bg-border)", color: "var(--color-text-primary)" }
      : { background: "var(--color-accent-arcane)", color: "#fff" };

  if (!href) return null;

  const inner = `${label} ${isExternal(href) ? "↗" : "→"}`;

  return (
    <div className={`max-w-6xl mx-auto px-6 py-4 flex ${justify}`}>
      {isExternal(href) ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
          {inner}
        </a>
      ) : (
        <Link href={href} className={className} style={style}>
          {inner}
        </Link>
      )}
    </div>
  );
}

function LinkListBlock({ props }: { props: Record<string, unknown> }) {
  const title = props.title as string | undefined;
  const links = parseJsonArray<ListLinkData>(props.links);
  if (links.length === 0) return null;

  return (
    <section className="max-w-3xl mx-auto px-6 py-6">
      <div className="fantasy-card p-5">
        {title && (
          <h2 className="font-cinzel text-xl tracking-widest uppercase mb-4"
            style={{ color: "var(--color-text-primary)" }}>{title}</h2>
        )}
        <div className="space-y-3">
          {links.map((link, index) => {
            if (!link.href || !link.label) return null;
            const ext = isExternal(link.href);
            const content = (
              <div className="rounded-md border px-3 py-3 transition-colors hover:border-amber-400"
                style={{ borderColor: "var(--color-bg-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {link.label} {ext ? "↗" : "→"}
                </p>
                {link.description && (
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{link.description}</p>
                )}
              </div>
            );
            return ext ? (
              <a key={`${link.href}-${index}`} href={link.href} target="_blank" rel="noopener noreferrer" className="block">
                {content}
              </a>
            ) : (
              <Link key={`${link.href}-${index}`} href={link.href} className="block">
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GalleryBlock({ props }: { props: Record<string, unknown> }) {
  const images = parseJsonArray<GalleryImageData>(props.images);
  const columns = (props.columns as string | undefined) ?? "3";
  const columnClass =
    columns === "4" ? "xl:grid-cols-4" :
    columns === "2" ? "lg:grid-cols-2" :
    "lg:grid-cols-3";
  if (images.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-8">
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${columnClass} gap-4`}>
        {images.map((image, index) => {
          if (!image.src) return null;
          return (
            <figure key={`${image.src}-${index}`} className="fantasy-card overflow-hidden">
              <div className="relative aspect-[4/3]">
                <Image src={image.src} alt={image.alt ?? ""} fill className="object-cover"
                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" />
              </div>
              {image.caption && (
                <figcaption className="p-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {image.caption}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

function EmbedBlock({ props }: { props: Record<string, unknown> }) {
  const src = props.src as string | undefined;
  const title = (props.title as string | undefined) ?? "Embedded content";
  const heightRaw = Number.parseInt((props.height as string | undefined) ?? "520", 10);
  const height = Number.isFinite(heightRaw) ? Math.min(Math.max(heightRaw, 220), 1200) : 520;
  if (!src) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-8">
      <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--color-bg-border)" }}>
        <iframe src={src} title={title} className="w-full" style={{ height, border: "none" }} />
      </div>
    </section>
  );
}

function CalendarEmbedBlock() {
  const calId = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID;
  if (!calId) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 text-center">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Calendar not configured. Set NEXT_PUBLIC_GOOGLE_CALENDAR_ID in your environment.
        </p>
      </div>
    );
  }
  const embedUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calId)}&ctz=America%2FNew_York&mode=AGENDA&showTitle=0&showPrint=0&showTabs=0&showCalendars=0`;
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--color-bg-border)" }}>
        <iframe
          src={embedUrl}
          className="w-full"
          style={{ height: "600px", border: "none", background: "#fff" }}
          title="Suwanee Gamers Calendar"
        />
      </div>
    </div>
  );
}

// ── Live data blocks ──────────────────────────────────────────────────────────

function CampaignsGridBlock() {
  const listed = listedCampaigns();
  const side   = sideCampaigns();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {listed.map((campaign) => (
          <Link key={campaign.id} href={`/campaigns/${campaign.id}`}
            className="fantasy-card block group overflow-hidden">
            {campaign.headerImage && (
              <div className="h-36 border-b" style={{
                backgroundImage: `linear-gradient(to bottom,rgba(8,5,15,.08),rgba(8,5,15,.62)),url("${campaign.headerImage}")`,
                backgroundPosition: campaign.headerImagePosition ?? "center",
                backgroundSize: "cover",
                borderColor: "var(--color-bg-border)",
              }} />
            )}
            <div className="p-5">
              <h3 className="font-cinzel text-lg leading-tight group-hover:text-amber-400 transition-colors mb-3"
                style={{ color: "var(--color-text-primary)" }}>{campaign.name}</h3>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{campaign.schedule}</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-accent-gold)" }}>DM: {campaign.dm}</p>
            </div>
          </Link>
        ))}
      </div>
      {side.length > 0 && (
        <div>
          <p className="font-cinzel text-xs tracking-[0.35em] uppercase mb-4"
            style={{ color: "var(--color-text-muted)" }}>Other Campaign Tools</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {side.map((campaign) => (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}
                className="fantasy-card block group overflow-hidden">
                <div className="p-5">
                  <h3 className="font-cinzel text-lg group-hover:text-amber-400 transition-colors mb-2"
                    style={{ color: "var(--color-text-primary)" }}>{campaign.name}</h3>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{campaign.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayersGridBlock() {
  const players = getPlayerProfiles();
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {players.map((player) => {
          const initials = player.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();
          return (
            <article key={player.id} className="fantasy-card overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr]">
                <div className="min-h-44 border-b sm:border-b-0 sm:border-r"
                  style={{
                    borderColor: "var(--color-bg-border)",
                    background: player.portrait
                      ? `linear-gradient(to bottom,rgba(8,5,15,.04),rgba(8,5,15,.6)),url("${player.portrait}") center/cover no-repeat`
                      : "linear-gradient(135deg,rgba(139,92,246,.28),rgba(245,158,11,.14))",
                  }}>
                  {!player.portrait && (
                    <div className="flex h-full min-h-44 items-center justify-center">
                      <span className="font-cinzel text-4xl" style={{ color: "var(--color-text-primary)" }}>{initials}</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-cinzel text-xl mb-1" style={{ color: "var(--color-text-primary)" }}>{player.name}</h3>
                  <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--color-text-secondary)" }}>{player.description}</p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {player.assignments.length} character{player.assignments.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function DmsGridBlock() {
  const dms = getDungeonMasters();
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {dms.map((profile) => {
          const active = campaignsForDm(profile);
          return (
            <article key={profile.id} className="fantasy-card overflow-hidden">
              {profile.portrait && (
                <div className="h-56 border-b" style={{
                  backgroundImage: `linear-gradient(to bottom,rgba(8,5,15,.02),rgba(8,5,15,.6)),url("${profile.portrait}")`,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                  borderColor: "var(--color-bg-border)",
                }} />
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-cinzel text-xl" style={{ color: "var(--color-text-primary)" }}>{profile.name}</h3>
                    <p className="text-sm mt-1" style={{ color: "var(--color-accent-gold)" }}>{profile.focus}</p>
                  </div>
                  <span className="text-xs font-cinzel tracking-widest uppercase px-2 py-1 rounded-full border shrink-0"
                    style={{
                      color: active.length ? "var(--color-accent-arcane)" : "var(--color-text-muted)",
                      borderColor: active.length ? "var(--color-accent-arcane)" : "var(--color-bg-border)",
                    }}>
                    {active.length ? "Active DM" : "Archive"}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{profile.description}</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function BestiaryGridBlock() {
  let creatures: Creature[] = [];
  try {
    creatures = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "../../content/bestiary.json"), "utf-8")
    ) as Creature[];
  } catch { /* ignore */ }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {creatures.map((creature) => (
          <article key={creature.name} className="fantasy-card overflow-hidden">
            <div className="relative aspect-[4/3] border-b" style={{ borderColor: "var(--color-bg-border)" }}>
              <Image src={creature.image} alt={`${creature.name} illustration`}
                fill sizes="(min-width:1280px) 33vw,(min-width:640px) 50vw,100vw"
                className="object-contain p-6" />
            </div>
            <div className="p-5">
              <h3 className="font-cinzel text-xl" style={{ color: "var(--color-text-primary)" }}>{creature.name}</h3>
              <p className="mt-1 text-xs font-cinzel tracking-[0.3em] uppercase"
                style={{ color: "var(--color-accent-arcane)" }}>{creature.type}</p>
              {creature.href && (
                <a href={creature.href} target="_blank" rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-cinzel tracking-widest uppercase transition-colors hover:text-amber-400"
                  style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-primary)" }}>
                  Stat Block ↗
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// ── Live calendar helpers ─────────────────────────────────────────────────────

const _dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short", month: "short", day: "numeric",
  timeZone: GOOGLE_CALENDAR_TIMEZONE,
});
const _timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric", minute: "2-digit",
  timeZone: GOOGLE_CALENDAR_TIMEZONE,
});

async function resolveNextDate(campaignName: string): Promise<string | null> {
  try {
    const events = await fetchUpcomingCalendarEvents(50);
    const name = normalizeCampaignTitle(campaignName);
    const match = events.find((event) => {
      const title = normalizeCampaignTitle(event.title);
      return title === name || title.includes(name) || name.includes(title);
    });
    if (!match) return null;
    const start = new Date(match.start);
    return match.allDay
      ? _dateFormatter.format(start)
      : `${_dateFormatter.format(start)} at ${_timeFormatter.format(start)}`;
  } catch {
    return null;
  }
}

/** Standalone "Next Session Date" profile-card item — async RSC. */
async function NextSessionItem({ campaignName }: { campaignName: string }) {
  const dateStr = await resolveNextDate(campaignName);
  return (
    <div>
      <p className="font-cinzel tracking-widest uppercase mb-1"
        style={{ color: "var(--color-text-muted)" }}>
        Next Date
      </p>
      <p style={{ color: dateStr ? "var(--color-accent-gold)" : "var(--color-text-secondary)" }}>
        {dateStr ?? "See calendar"}
      </p>
    </div>
  );
}

/** Campaign info section (schedule + DM + live date) — async RSC. */
async function CampaignInfoItem({
  schedule, dm, campaignName,
}: {
  schedule?: string;
  dm?: string;
  campaignName?: string;
}) {
  const dateStr = campaignName ? await resolveNextDate(campaignName) : null;
  return (
    <div className="space-y-4 pt-4 border-t text-sm" style={{ borderColor: "var(--color-bg-border)" }}>
      {(schedule || dm) && (
        <div>
          {schedule && (
            <p className="font-cinzel tracking-widest uppercase mb-1"
              style={{ color: "var(--color-text-muted)" }}>
              {schedule}
            </p>
          )}
          {dm && (
            <p style={{ color: "var(--color-accent-gold)" }}>DM: {dm}</p>
          )}
        </div>
      )}
      {campaignName && (
        <div>
          <p className="font-cinzel tracking-widest uppercase mb-1"
            style={{ color: "var(--color-text-muted)" }}>
            Next Date
          </p>
          <p style={{ color: dateStr ? "var(--color-accent-gold)" : "var(--color-text-secondary)" }}>
            {dateStr ?? "See calendar"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Single-item live data blocks ──────────────────────────────────────────────

/** Single campaign card — reads from campaigns.json, fetches live next date. */
async function CampaignCardBlock({
  props,
  variant = "standalone",
}: {
  props: Record<string, unknown>;
  variant?: "standalone" | "grid-item";
}) {
  const id = props.id as string;
  const campaign = findCampaign(id);
  if (!campaign) return null;

  const inGrid = variant === "grid-item";
  const dateStr = campaign.schedule !== "No cadence"
    ? await resolveNextDate(campaign.name)
    : null;

  const inner = (
    <article className="fantasy-card overflow-hidden h-full">
      {campaign.headerImage && (
        <div
          className="h-36 border-b"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(8, 5, 15, 0.08), rgba(8, 5, 15, 0.62)), url("${campaign.headerImage}")`,
            backgroundPosition: campaign.headerImagePosition ?? "center",
            backgroundSize: "cover",
            borderColor: "var(--color-bg-border)",
          }}
        />
      )}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2
            className="font-cinzel text-2xl leading-tight group-hover:text-amber-400 transition-colors"
            style={{ color: "var(--color-text-primary)" }}
          >
            {campaign.name}
          </h2>
          <span
            className="shrink-0 text-xs font-cinzel tracking-widest uppercase px-2.5 py-1 rounded-full border"
            style={{ color: "var(--color-accent-arcane)", borderColor: "var(--color-accent-arcane)" }}
          >
            Active
          </span>
        </div>
        <div className="space-y-4 pt-4 border-t text-sm" style={{ borderColor: "var(--color-bg-border)" }}>
          <div>
            <p className="font-cinzel tracking-widest uppercase mb-1"
              style={{ color: "var(--color-text-muted)" }}>
              {campaign.schedule}
            </p>
            <p style={{ color: "var(--color-accent-gold)" }}>DM: {campaign.dm}</p>
          </div>
          <div>
            <p className="font-cinzel tracking-widest uppercase mb-1"
              style={{ color: "var(--color-text-muted)" }}>
              Next Date
            </p>
            <p style={{ color: dateStr ? "var(--color-accent-gold)" : "var(--color-text-secondary)" }}>
              {dateStr ?? "See calendar"}
            </p>
          </div>
        </div>
      </div>
    </article>
  );

  const linked = (
    <Link href={`/campaigns/${campaign.id}`} className="block group h-full">
      {inner}
    </Link>
  );

  return inGrid ? linked : <div className="max-w-6xl mx-auto px-6 py-2.5">{linked}</div>;
}

/** Single player card — reads from players.json with live character assignments. */
function PlayerCardBlock({
  props,
  variant = "standalone",
}: {
  props: Record<string, unknown>;
  variant?: "standalone" | "grid-item";
}) {
  const id = props.id as string;
  const players = getPlayerProfiles();
  const player = players.find((p) => p.id === id);
  if (!player) return null;

  const inGrid = variant === "grid-item";
  const initials = player.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();

  const inner = (
    <article className="fantasy-card overflow-hidden h-full">
      <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] min-h-64">
        <div
          className="min-h-56 border-b sm:border-b-0 sm:border-r"
          style={{
            borderColor: "var(--color-bg-border)",
            background: player.portrait
              ? `linear-gradient(to bottom, rgba(8, 5, 15, 0.04), rgba(8, 5, 15, 0.64)), url("${player.portrait}") center / cover no-repeat`
              : "linear-gradient(135deg, rgba(139, 92, 246, 0.28), rgba(245, 158, 11, 0.14))",
          }}
          role="img"
          aria-label={`${player.name} profile image`}
        >
          {!player.portrait && (
            <div className="flex h-full min-h-56 items-center justify-center">
              <span className="font-cinzel text-5xl" style={{ color: "var(--color-text-primary)" }}>
                {initials}
              </span>
            </div>
          )}
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="font-cinzel text-2xl leading-tight" style={{ color: "var(--color-text-primary)" }}>
                {player.name}
              </h2>
              {player.dmProfileId && (
                <Link
                  href="/dungeon-masters"
                  className="mt-2 inline-block text-xs font-cinzel tracking-widest uppercase transition-colors hover:text-amber-400"
                  style={{ color: "var(--color-accent-gold)" }}
                >
                  Dungeon Master
                </Link>
              )}
            </div>
            <span
              className="shrink-0 text-xs font-cinzel tracking-widest uppercase px-2.5 py-1 rounded-full border self-start"
              style={{
                color: player.assignments.length ? "var(--color-accent-arcane)" : "var(--color-text-muted)",
                borderColor: player.assignments.length ? "var(--color-accent-arcane)" : "var(--color-bg-border)",
              }}
            >
              {player.assignments.length} Character{player.assignments.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--color-text-secondary)" }}>
            {player.description}
          </p>
          <div className="space-y-3">
            {player.assignments.map(({ character, campaign }) => (
              <div
                key={`${campaign.id}-${character.name}`}
                className="rounded-md border px-3 py-3"
                style={{ borderColor: "var(--color-bg-border)" }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    {character.url ? (
                      <a
                        href={character.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold transition-colors hover:text-amber-400"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {character.name}
                      </a>
                    ) : (
                      <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {character.name}
                      </span>
                    )}
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="block text-xs mt-1 transition-colors hover:text-amber-400"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {campaign.name}
                    </Link>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: "var(--color-accent-gold)" }}>
                    DM: {campaign.dm}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );

  return inGrid ? inner : <div className="max-w-6xl mx-auto px-6 py-2.5">{inner}</div>;
}

interface Creature { name: string; type: string; image: string; href?: string; }

/** Single creature card — reads from bestiary.json. */
function CreatureCardBlock({
  props,
  variant = "standalone",
}: {
  props: Record<string, unknown>;
  variant?: "standalone" | "grid-item";
}) {
  const name = props.name as string;
  let creatures: Creature[] = [];
  try {
    creatures = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "../../content/bestiary.json"), "utf-8")
    ) as Creature[];
  } catch { /* ignore */ }

  const creature = creatures.find((c) => c.name === name);
  if (!creature) return null;

  const inGrid = variant === "grid-item";

  const inner = (
    <article className="fantasy-card overflow-hidden h-full">
      <div className="relative aspect-[4/3] border-b" style={{ borderColor: "var(--color-bg-border)" }}>
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
            <p className="mt-2 text-xs font-cinzel tracking-[0.3em] uppercase"
              style={{ color: "var(--color-accent-arcane)" }}>
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
            style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-primary)" }}
          >
            Stat Block ↗
          </a>
        ) : (
          <p className="mt-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
            No stat block link on the legacy source page.
          </p>
        )}
      </div>
    </article>
  );

  return inGrid ? inner : <div className="max-w-6xl mx-auto px-6 py-2.5">{inner}</div>;
}

// ── Profile card ─────────────────────────────────────────────────────────────

function numberProp(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function cardLayoutPlacementStyle(item: CardLayoutItem): CSSProperties {
  const col = numberProp(item.props.col, 1, 1, 6);
  const row = numberProp(item.props.row, 1, 1, 10);
  const colSpan = numberProp(item.props.colSpan, 1, 1, 6);
  const rowSpan = numberProp(item.props.rowSpan, 1, 1, 10);
  const hasPlacement = item.props.col || item.props.row || item.props.colSpan || item.props.rowSpan;
  if (!hasPlacement) return {};
  return {
    gridColumn: `${col} / span ${colSpan}`,
    gridRow: `${row} / span ${rowSpan}`,
  };
}

function parseCardLayoutItems(raw: unknown): CardLayoutItem[] {
  if (Array.isArray(raw)) return raw as CardLayoutItem[];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? (parsed as CardLayoutItem[]) : [];
  } catch {
    return [];
  }
}

function CardLayoutGrid({ item }: { item: CardLayoutItem }) {
  const columns = numberProp(item.props.columns, 2, 1, 6);
  const rows = numberProp(item.props.rows, 1, 1, 10);
  const gap = (item.props.gap as string | undefined) ?? "md";
  const gapClass = gap === "sm" ? "gap-2" : gap === "lg" ? "gap-5" : "gap-3";
  const children = parseCardLayoutItems(item.props.items);

  return (
    <div
      className={`grid ${gapClass}`}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, auto))`,
      }}
    >
      {children.map((child) => (
        <CardLayoutItemRenderer key={child.id} item={child} />
      ))}
    </div>
  );
}

function CardLayoutItemRenderer({ item }: { item: CardLayoutItem }) {
  const style = cardLayoutPlacementStyle(item);

  switch (item.type) {
    case "grid":
      return (
        <div style={style}>
          <CardLayoutGrid item={item} />
        </div>
      );
    case "header": {
      const eyebrow = item.props.eyebrow as string | undefined;
      const title = item.props.title as string | undefined;
      const size = item.props.size as string | undefined;
      if (!eyebrow && !title) return null;
      return (
        <header style={style} className="min-w-0">
          {eyebrow && (
            <p className="font-cinzel text-[0.65rem] tracking-[0.3em] uppercase mb-1"
              style={{ color: "var(--color-accent-arcane)" }}>
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className={`font-cinzel leading-tight ${size === "lg" ? "text-2xl" : "text-lg"}`}
              style={{ color: "var(--color-text-primary)" }}>
              {title}
            </h2>
          )}
        </header>
      );
    }
    case "text": {
      const content = item.props.content as string | undefined;
      if (!content) return null;
      return (
        <p className="min-w-0 whitespace-pre-wrap text-sm leading-relaxed"
          style={{ ...style, color: "var(--color-text-secondary)" }}>
          {content}
        </p>
      );
    }
    case "inner-card": {
      const children = parseCardLayoutItems(item.props.items);
      return (
        <div className="rounded-md border p-4 min-w-0 h-full"
          style={{ ...style, borderColor: "var(--color-bg-border)", background: "rgba(15,10,26,.58)" }}>
          <div className="space-y-3">
            {children.map((child) => (
              <CardLayoutItemRenderer key={child.id} item={child} />
            ))}
          </div>
        </div>
      );
    }
    case "image": {
      const src = item.props.src as string | undefined;
      const alt = (item.props.alt as string | undefined) ?? "";
      const fit = (item.props.fit as string | undefined) ?? "cover";
      if (!src) return null;
      return (
        <div className="relative min-h-36 overflow-hidden rounded-md border"
          style={{ ...style, borderColor: "var(--color-bg-border)" }}>
          <Image src={src} alt={alt} fill className={fit === "contain" ? "object-contain p-3" : "object-cover"}
            sizes="(min-width: 1024px) 50vw, 100vw" />
        </div>
      );
    }
    case "divider":
      return <div className="h-px self-center" style={{ ...style, background: "var(--color-bg-border)" }} />;
    case "person": {
      const name = item.props.name as string | undefined;
      const role = item.props.role as string | undefined;
      const img  = item.props.img  as string | undefined;
      return (
        <div className="flex flex-col items-center gap-2 py-2 min-w-0" style={style}>
          {img ? (
            <Image src={img} alt={name ?? ""} width={80} height={80}
              className="w-20 h-20 rounded-full object-cover object-top shrink-0"
              style={{ border: "2px solid var(--color-accent-gold)" }} />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center font-cinzel text-lg shrink-0"
              style={{ border: "2px solid var(--color-accent-gold)", background: "var(--color-bg-card)", color: "var(--color-accent-gold)" }}>
              {(name ?? "?")[0]}
            </div>
          )}
          {name && (
            <p className="font-cinzel text-base text-center" style={{ color: "var(--color-accent-gold)" }}>{name}</p>
          )}
          {role && (
            <p className="text-xs tracking-widest uppercase text-center" style={{ color: "var(--color-text-muted)" }}>{role}</p>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}

function GridSectionBlock({ props }: { props: Record<string, unknown> }) {
  const columns = Math.min(Math.max(parseInt(String(props.columns ?? "2"), 10) || 2, 1), 6);
  const gap = (props.gap as string | undefined) ?? "md";
  const gapCss = gap === "sm" ? "0.75rem" : gap === "lg" ? "1.5rem" : "1.125rem";
  const children = parseGridSectionItems(props.items);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: gapCss,
      }}
    >
      {children.map((child) => (
        <div
          key={child.id}
          style={{
            gridColumn: `${child.col} / span ${child.colSpan}`,
            gridRow: `${child.row} / span ${child.rowSpan}`,
            minWidth: 0,
          }}
        >
          <BlockRenderer
            block={{ kind: "block", id: child.id, type: child.type, props: child.props }}
            variant="grid-item"
          />
        </div>
      ))}
    </div>
  );
}

function CardLayoutBlock({
  props,
  variant = "standalone",
}: {
  props: Record<string, unknown>;
  variant?: "standalone" | "grid-item";
}) {
  const width = (props.width as string | undefined) ?? "wide";
  const items = parseCardLayoutItems(props.items);
  const widthClass =
    width === "full" ? "w-full px-0" :
    width === "medium" ? "max-w-3xl mx-auto px-6" :
    "max-w-6xl mx-auto px-6";

  const card = (
    <article className="fantasy-card p-5 md:p-6 h-full">
      <div className="space-y-4">
        {items.map((item) => (
          <CardLayoutItemRenderer key={item.id} item={item} />
        ))}
      </div>
    </article>
  );

  if (variant === "grid-item") return card;
  return <section className={`${widthClass} py-6`}>{card}</section>;
}

function ProfileCardItemRenderer({
  item,
  characters,
}: {
  item: ProfileCardItem;
  characters?: SavedCharacterData[];
}) {
  switch (item.type) {
    case "portrait": {
      const src = item.props.src as string | undefined;
      const name = item.props.name as string | undefined;
      const initials = name
        ? name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
        : "?";
      if (src) {
        return (
          <div className="relative mb-3 aspect-video overflow-hidden rounded-md border"
            style={{ borderColor: "var(--color-bg-border)" }}>
            <Image src={src} alt={name ? `${name} profile image` : ""} fill className="object-cover"
              sizes="(min-width: 1024px) 33vw, 100vw" />
          </div>
        );
      }
      return (
        <div className="mb-3 flex aspect-video items-center justify-center rounded-md border"
          style={{
            borderColor: "var(--color-bg-border)",
            background: "linear-gradient(135deg,rgba(139,92,246,.28),rgba(245,158,11,.14))",
          }}>
          <span className="font-cinzel text-4xl" style={{ color: "var(--color-text-primary)" }}>
            {initials}
          </span>
        </div>
      );
    }
    case "image": {
      const src = item.props.src as string | undefined;
      const alt = (item.props.alt as string | undefined) ?? "";
      const shape = (item.props.shape as string | undefined) ?? "wide";
      const aspect = shape === "square" ? "aspect-square" : shape === "creature" ? "aspect-[4/3]" : "aspect-video";
      const fit = (shape === "contain" || shape === "creature") ? "object-contain p-6" : "object-cover";
      if (!src) return null;
      return (
        <div className={`relative ${aspect} overflow-hidden rounded-md border mb-3`}
          style={{ borderColor: "var(--color-bg-border)" }}>
          <Image src={src} alt={alt} fill className={fit}
            sizes="(min-width: 1024px) 33vw, 100vw" />
        </div>
      );
    }
    case "heading": {
      const headingSize = item.props.size as string | undefined;
      if (headingSize === "large") {
        return (
          <h2
            className="font-cinzel text-2xl leading-tight group-hover:text-amber-400 transition-colors"
            style={{ color: "var(--color-text-primary)" }}
          >
            {item.props.value as string}
          </h2>
        );
      }
      return (
        <h2 className="font-cinzel text-xl" style={{ color: "var(--color-text-primary)" }}>
          {item.props.value as string}
        </h2>
      );
    }
    case "eyebrow": {
      const eyebrowVariant = item.props.variant as string | undefined;
      if (eyebrowVariant === "subtitle") {
        // Matches the original DM / player card focus-text style: plain text-sm in gold.
        return (
          <p className="text-sm mt-1" style={{ color: "var(--color-accent-gold)" }}>
            {item.props.value as string}
          </p>
        );
      }
      return (
        <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-1"
          style={{ color: "var(--color-accent-arcane)" }}>
          {item.props.value as string}
        </p>
      );
    }
    case "description":
      return (
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          {item.props.value as string}
        </p>
      );
    case "stat":
      return (
        <div className="mb-2 rounded-md border px-3 py-2"
          style={{ borderColor: "var(--color-bg-border)" }}>
          <p className="text-[0.65rem] font-cinzel tracking-widest uppercase"
            style={{ color: "var(--color-text-muted)" }}>{item.props.label as string}</p>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {item.props.value as string}
          </p>
        </div>
      );
    case "character-count": {
      const count = characters?.length ?? 0;
      return (
        <span
          className="shrink-0 text-xs font-cinzel tracking-widest uppercase px-2.5 py-1 rounded-full border self-start"
          style={{
            color: count ? "var(--color-accent-arcane)" : "var(--color-text-muted)",
            borderColor: count ? "var(--color-accent-arcane)" : "var(--color-bg-border)",
          }}>
          {count} Character{count === 1 ? "" : "s"}
        </span>
      );
    }
    case "badge": {
      const color = (item.props.color as string | undefined) ?? "arcane";
      const colorVar =
        color === "gold"  ? "var(--color-accent-gold)"   :
        color === "muted" ? "var(--color-text-muted)"    :
                            "var(--color-accent-arcane)";
      // Border uses a softer bg-border for muted/archive badges, matching the original card style.
      const borderVar = color === "muted" ? "var(--color-bg-border)" : colorVar;
      return (
        <span className="text-xs font-cinzel tracking-widest uppercase px-2 py-1 rounded-full border"
          style={{ color: colorVar, borderColor: borderVar }}>
          {item.props.value as string}
        </span>
      );
    }
    case "link": {
      const href  = (item.props.href  as string) ?? "#";
      const label = (item.props.label as string) ?? href;
      const ext   = isExternal(href);
      const cls   = "inline-block text-xs font-cinzel tracking-widest uppercase transition-colors hover:text-amber-400 mb-2";
      const style = { color: "var(--color-accent-gold)" };
      return ext
        ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{label} ↗</a>
        : <Link href={href} className={cls} style={style}>{label} →</Link>;
    }
    case "divider":
      return <div className="my-3 h-px" style={{ background: "var(--color-bg-border)" }} />;
    case "item-list": {
      const title = item.props.title as string | undefined;
      const entries = parseJsonArray<SavedEntryData>(item.props.entries);
      if (entries.length === 0) return null;
      return (
        <section className="mt-4">
          {title && (
            <h3 className="font-cinzel text-xs tracking-widest uppercase mb-3"
              style={{ color: "var(--color-text-muted)" }}>
              {title}
            </h3>
          )}
          <div className="space-y-2">
            {entries.map((entry, index) => {
              const inner = (
                <div className="rounded-md border px-3 py-3 transition-colors hover:border-amber-400"
                  style={{ borderColor: "var(--color-bg-border)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {entry.title && (
                        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          {entry.title}
                        </p>
                      )}
                      {entry.subtitle && (
                        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                          {entry.subtitle}
                        </p>
                      )}
                      {entry.meta && (
                        <p className="text-xs mt-1" style={{ color: "var(--color-accent-gold)" }}>
                          {entry.meta}
                        </p>
                      )}
                    </div>
                    {entry.status && (
                      <span className="text-[0.68rem] font-cinzel tracking-widest uppercase shrink-0"
                        style={{ color: "var(--color-accent-gold)" }}>
                        {entry.status}
                      </span>
                    )}
                  </div>
                </div>
              );
              return entry.url ? (
                <a key={`${entry.title}-${index}`} href={entry.url} target="_blank" rel="noopener noreferrer" className="block">
                  {inner}
                </a>
              ) : (
                <div key={`${entry.title}-${index}`}>{inner}</div>
              );
            })}
          </div>
        </section>
      );
    }
    case "character-list": {
      const characterRows = savedCharactersFromItem(item);
      if (characterRows.length === 0) return null;
      return (
        <div className="space-y-2 mt-1">
          {characterRows.map((character, index) => (
            <div key={`${character.campaign}-${character.name}-${index}`}
              className="rounded-md border px-3 py-3"
              style={{ borderColor: "var(--color-bg-border)" }}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  {character.url ? (
                    <a href={character.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-semibold transition-colors hover:text-amber-400"
                      style={{ color: "var(--color-text-primary)" }}>
                      {character.name}
                    </a>
                  ) : (
                    <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {character.name}
                    </span>
                  )}
                  {character.campaign && (
                    <span className="block text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                      {character.campaign}
                    </span>
                  )}
                </div>
                {character.dm && (
                  <span className="text-xs shrink-0" style={{ color: "var(--color-accent-gold)" }}>
                    DM: {character.dm}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "next-session": {
      const campaignName = (item.props.campaignName as string | undefined) ?? "";
      if (!campaignName) return null;
      // NextSessionItem is an async RSC — safe to render from a sync RSC
      return <NextSessionItem campaignName={campaignName} />;
    }
    case "campaign-info":
      return (
        <CampaignInfoItem
          schedule={item.props.schedule as string | undefined}
          dm={item.props.dm as string | undefined}
          campaignName={item.props.campaignName as string | undefined}
        />
      );
    default:
      return null;
  }
}

function ProfileCardBlock({
  props,
  variant = "standalone",
}: {
  props: Record<string, unknown>;
  variant?: "standalone" | "grid-item";
}) {
  const layout = (props.layout as string | undefined) ?? "side";
  const inGrid = variant === "grid-item";

  function wrapCard(card: ReactNode) {
    if (inGrid) return card;
    return <div className="max-w-6xl mx-auto px-6 py-2.5">{card}</div>;
  }

  let items: ProfileCardItem[] = [];
  try {
    const parsed = JSON.parse((props.items as string) ?? "[]");
    if (Array.isArray(parsed)) items = parsed;
  } catch { /* malformed JSON */ }

  const portraitItem = items.find((i) => i.type === "portrait" && i.props.position !== "inline");
  const contentItems = items.filter((i) => i !== portraitItem);
  const headingItem = contentItems.find((i) => i.type === "heading");
  const countItem = contentItems.find((i) => i.type === "character-count");
  const badgeItem = contentItems.find((i) => i.type === "badge");
  const characterListItem = contentItems.find((i) => i.type === "character-list");
  const cardCharacters = characterListItem ? savedCharactersFromItem(characterListItem) : [];
  const headerLinkItems = contentItems.filter((i) => i.type === "link");
  // Badge joins the heading row (right-aligned) when there is a heading — matches the
  // name / status-pill layout used by DM and player cards.
  // Eyebrow / subtitle items sit inside the left column of the header row (under the name),
  // matching the original gold focus-text placement in DM and player grid cards.
  const eyebrowItems = contentItems.filter((i) => i.type === "eyebrow");
  const headerItems = new Set([
    headingItem?.id,
    countItem?.id,
    ...(headingItem && badgeItem ? [badgeItem.id] : []),
    ...eyebrowItems.map((i) => i.id),
    ...headerLinkItems.map((item) => item.id),
  ].filter(Boolean));
  const bodyItems = contentItems.filter((item) => !headerItems.has(item.id));

  const portraitSrc  = portraitItem?.props.src  as string | undefined;
  const portraitName = portraitItem?.props.name as string | undefined;
  const nameInitials = portraitName
    ? portraitName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const portraitBg = portraitSrc
    ? `linear-gradient(to bottom,rgba(8,5,15,.04),rgba(8,5,15,.64)),url("${portraitSrc}") center/cover no-repeat`
    : "linear-gradient(135deg,rgba(139,92,246,.28),rgba(245,158,11,.14))";

  /** Renders body items, pairing consecutive item-lists side-by-side in a 2-column grid. */
  function renderBodyItems(items: ProfileCardItem[]) {
    const out: ReactNode[] = [];
    let i = 0;
    while (i < items.length) {
      const cur = items[i];
      const next = items[i + 1];
      if (cur.type === "item-list" && next?.type === "item-list") {
        out.push(
          <div key={`pair-${cur.id}`} className="grid grid-cols-2 gap-3 mt-4">
            <ProfileCardItemRenderer item={cur} />
            <ProfileCardItemRenderer item={next} />
          </div>
        );
        i += 2;
      } else {
        out.push(<ProfileCardItemRenderer key={cur.id} item={cur} />);
        i += 1;
      }
    }
    return out;
  }

  function renderContent() {
    if (!headingItem && !countItem) {
      return renderBodyItems(contentItems);
    }

    const hasRightCol = !!(countItem || (headingItem && badgeItem));
    return (
      <>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {headingItem && <ProfileCardItemRenderer item={headingItem} />}
            {eyebrowItems.map((item) => (
              <ProfileCardItemRenderer key={item.id} item={item} />
            ))}
            {headerLinkItems.map((item) => (
              <ProfileCardItemRenderer key={item.id} item={item} />
            ))}
          </div>
          {hasRightCol && (
            <div className="shrink-0 flex flex-col items-end gap-1">
              {countItem && <ProfileCardItemRenderer item={countItem} characters={cardCharacters} />}
              {headingItem && badgeItem && <ProfileCardItemRenderer item={badgeItem} />}
            </div>
          )}
        </div>
        {renderBodyItems(bodyItems)}
      </>
    );
  }

  if (layout === "top") {
    return wrapCard(
        <article className="fantasy-card overflow-hidden h-full">
          <div
            className="h-56 border-b"
            style={{
              borderColor: "var(--color-bg-border)",
              background: portraitBg,
            }}
            role="img"
            aria-label={portraitName ? `${portraitName} profile image` : undefined}
          >
            {!portraitSrc && portraitName && (
              <div className="flex h-full items-center justify-center">
                <span className="font-cinzel text-5xl" style={{ color: "var(--color-text-primary)" }}>
                  {nameInitials}
                </span>
              </div>
            )}
          </div>
          <div className="p-5">
            {renderContent()}
          </div>
        </article>
    );
  }

  if (layout === "none") {
    return wrapCard(
        <article className="fantasy-card p-6 overflow-hidden h-full">
          {items.map((item) => (
            <ProfileCardItemRenderer key={item.id} item={item} />
          ))}
        </article>
    );
  }

  // layout === "side" (default)
  return wrapCard(
      <article className="fantasy-card overflow-hidden h-full">
        <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] min-h-64">
          <div
            className="min-h-56 border-b sm:border-b-0 sm:border-r"
            style={{
              borderColor: "var(--color-bg-border)",
              background: portraitBg,
            }}
            role="img"
            aria-label={portraitName ? `${portraitName} profile image` : undefined}
          >
            {!portraitSrc && (
              <div className="flex h-full min-h-56 items-center justify-center">
                <span className="font-cinzel text-5xl" style={{ color: "var(--color-text-primary)" }}>
                  {nameInitials}
                </span>
              </div>
            )}
          </div>
          <div className="p-5">
            {renderContent()}
          </div>
        </div>
      </article>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

function BlockContent({
  block,
  variant,
  children,
}: {
  block: BlockItem;
  variant?: "standalone" | "grid-item";
  children?: ReactNode;
}) {
  switch (block.type) {
    // Generic content
    case "divider":         return <DividerBlock       props={block.props} />;
    case "card":            return <CardBlock          props={block.props} />;
    case "image":           return <ImageBlock         props={block.props} />;
    case "text":            return <TextBlock          props={block.props} />;
    case "callout":         return <CalloutBlock       props={block.props} />;
    case "section-heading": return <SectionHeadingBlock props={block.props} />;
    case "button-link":     return <ButtonLinkBlock    props={block.props} />;
    case "link-list":       return <LinkListBlock      props={block.props} />;
    case "gallery":         return <GalleryBlock       props={block.props} />;
    case "embed":           return <EmbedBlock         props={block.props} />;
    case "spacer":          return <SpacerBlock        props={block.props} />;
    case "quote":           return <QuoteBlock         props={block.props} />;
    case "card-grid":       return <CardGridBlock      props={block.props}>{children}</CardGridBlock>;
    // Layout
    case "page-header":     return <PageHeaderBlock    props={block.props} />;
    case "page-banner":     return <HeroSection />;
    case "portal-links":    return <PortalLinksBlock   props={block.props} />;
    case "calendar-embed":  return <CalendarEmbedBlock />;
    // Live data
    case "campaigns-grid":  return <CampaignsGridBlock />;
    case "players-grid":    return <PlayersGridBlock />;
    case "dms-grid":        return <DmsGridBlock />;
    case "bestiary-grid":   return <BestiaryGridBlock />;
    // Single-item live data
    case "campaign-card":   return <CampaignCardBlock  props={block.props} variant={variant} />;
    case "player-card":     return <PlayerCardBlock    props={block.props} variant={variant} />;
    case "creature-card":   return <CreatureCardBlock  props={block.props} variant={variant} />;
    case "profile-card":    return <ProfileCardBlock   props={block.props} variant={variant} />;
    case "layout-card":     return <CardLayoutBlock    props={block.props} variant={variant} />;
    case "grid-section":    return <GridSectionBlock   props={block.props} />;
    default:                return null;
  }
}

/** Wrapper adds data-block-id so the live page editor can locate each block. */
export function BlockRenderer({
  block,
  variant = "standalone",
  children,
}: {
  block: BlockItem;
  variant?: "standalone" | "grid-item";
  children?: ReactNode;
}) {
  return (
    <div data-block-id={block.id} data-block-type={block.type}>
      <BlockContent block={block} variant={variant}>
        {children}
      </BlockContent>
    </div>
  );
}
