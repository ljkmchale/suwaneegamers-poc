import fs from "fs";
import path from "path";
import Image from "next/image";
import Link from "next/link";
import { HeroSection } from "@/components/fantasy/HeroSection";
import { listedCampaigns, sideCampaigns } from "@/lib/campaigns";
import { getPlayerProfiles } from "@/lib/players";
import { getDungeonMasters, campaignsForDm } from "@/lib/dungeonMasters";
import type { BlockItem } from "@/lib/pageBlocks";

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
  const variant = (props.variant as string | undefined) ?? "gold";
  const colorVar =
    variant === "arcane" ? "var(--color-accent-arcane)" :
    variant === "blood"  ? "var(--color-accent-blood)"  :
                           "var(--color-accent-gold)";
  return (
    <div className="max-w-3xl mx-auto px-6 py-4">
      <div className="rounded-lg border-l-4 p-5"
        style={{ borderColor: colorVar, background: "var(--color-bg-card)" }}>
        {title && (
          <p className="font-cinzel text-sm tracking-widest uppercase mb-2" style={{ color: colorVar }}>
            {title}
          </p>
        )}
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{content}</p>
      </div>
    </div>
  );
}

function SpacerBlock({ props }: { props: Record<string, unknown> }) {
  const size = (props.size as string | undefined) ?? "md";
  const h = size === "sm" ? "h-8" : size === "lg" ? "h-24" : "h-16";
  return <div className={h} aria-hidden="true" />;
}

// ── Layout blocks ─────────────────────────────────────────────────────────────

function PageHeaderBlock({ props }: { props: Record<string, unknown> }) {
  const eyebrow     = props.eyebrow     as string | undefined;
  const title       = props.title       as string | undefined;
  const description = props.description as string | undefined;
  const align       = (props.align as string | undefined) ?? "center";
  const cls = align === "center" ? "text-center" : "";

  return (
    <header className={`mb-14 max-w-6xl mx-auto px-6 pt-20 ${cls}`}>
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

function PortalLinksBlock({ props }: { props: Record<string, unknown> }) {
  const eyebrow     = props.eyebrow     as string | undefined;
  const title       = props.title       as string | undefined;
  const description = props.description as string | undefined;
  const raw         = props.links       as string | undefined;

  let links: PortalLinkData[] = [];
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

interface Creature { name: string; type: string; image: string; href?: string; }

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

// ── Public export ─────────────────────────────────────────────────────────────

function BlockContent({ block }: { block: BlockItem }) {
  switch (block.type) {
    // Generic content
    case "divider":         return <DividerBlock       props={block.props} />;
    case "card":            return <CardBlock          props={block.props} />;
    case "image":           return <ImageBlock         props={block.props} />;
    case "text":            return <TextBlock          props={block.props} />;
    case "callout":         return <CalloutBlock       props={block.props} />;
    case "spacer":          return <SpacerBlock        props={block.props} />;
    // Layout
    case "page-header":     return <PageHeaderBlock    props={block.props} />;
    case "hero-banner":     return <HeroSection />;
    case "portal-links":    return <PortalLinksBlock   props={block.props} />;
    case "calendar-embed":  return <CalendarEmbedBlock />;
    // Live data
    case "campaigns-grid":  return <CampaignsGridBlock />;
    case "players-grid":    return <PlayersGridBlock />;
    case "dms-grid":        return <DmsGridBlock />;
    case "bestiary-grid":   return <BestiaryGridBlock />;
    default:                return null;
  }
}

/** Wrapper adds data-block-id so the live page editor can locate each block. */
export function BlockRenderer({ block }: { block: BlockItem }) {
  return (
    <div data-block-id={block.id}>
      <BlockContent block={block} />
    </div>
  );
}
