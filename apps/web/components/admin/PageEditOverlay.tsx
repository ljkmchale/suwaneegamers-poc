"use client";

import { useState, useEffect, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Active,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { savePageLayoutAction } from "@/app/admin/page-layout/actions";
import { PAGE_SECTIONS } from "@/lib/pageSections";
import {
  getAssetDef,
  type PageItem,
  type BlockItem,
  type BlockType,
  type CardLayoutItem,
  type PageGridMeta,
} from "@/lib/pageBlocks";
import { PageDragLayer } from "./PageDragLayer";
import { PageEditPanel } from "./PageEditPanel";
import { CardLayoutGridEditor } from "./CardLayoutGridEditor";
import { BlockPicker } from "./BlockPicker";

// ── Types ─────────────────────────────────────────────────────────────────────

type DragData =
  | { kind: "existing"; dndId: string }
  | { kind: "new-asset"; assetType: BlockType };

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemDndId(item: PageItem) {
  return item.kind === "section" ? `section::${item.id}` : item.id;
}

function makeBlock(assetType: BlockType): BlockItem {
  const def = getAssetDef(assetType)!;
  return {
    kind: "block",
    id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: assetType,
    props: { ...def.defaultProps },
  };
}

// ── Main overlay entry point ──────────────────────────────────────────────────

function parseDraftItems(raw: unknown): CardLayoutItem[] {
  if (Array.isArray(raw)) return raw as CardLayoutItem[];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? (parsed as CardLayoutItem[]) : [];
  } catch {
    return [];
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function DraftCardLayoutItem({ item }: { item: CardLayoutItem }) {
  const col = clampNumber(item.props.col, 1, 1, 6);
  const row = clampNumber(item.props.row, 1, 1, 10);
  const colSpan = clampNumber(item.props.colSpan, 1, 1, 6);
  const rowSpan = clampNumber(item.props.rowSpan, 1, 1, 10);
  const hasPlacement = item.props.col || item.props.row || item.props.colSpan || item.props.rowSpan;
  const placement = hasPlacement ? {
    gridColumn: `${col} / span ${colSpan}`,
    gridRow: `${row} / span ${rowSpan}`,
  } : undefined;

  if (item.type === "grid") {
    const columns = clampNumber(item.props.columns, 2, 1, 6);
    const rows = clampNumber(item.props.rows, 1, 1, 10);
    const gap = item.props.gap === "sm" ? "0.5rem" : item.props.gap === "lg" ? "1.25rem" : "0.75rem";
    return (
      <div style={placement}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, auto))`,
          gap,
        }}>
          {parseDraftItems(item.props.items).map((child) => (
            <DraftCardLayoutItem key={child.id} item={child} />
          ))}
        </div>
      </div>
    );
  }

  if (item.type === "header") {
    return (
      <header style={placement}>
        {item.props.eyebrow ? (
          <p className="font-cinzel text-[0.65rem] tracking-[0.3em] uppercase mb-1"
            style={{ color: "var(--color-accent-arcane)" }}>
            {item.props.eyebrow as string}
          </p>
        ) : null}
        {item.props.title ? (
          <h2 className={`font-cinzel leading-tight ${item.props.size === "lg" ? "text-2xl" : "text-lg"}`}
            style={{ color: "var(--color-text-primary)" }}>
            {item.props.title as string}
          </h2>
        ) : null}
      </header>
    );
  }

  if (item.type === "text") {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ ...placement, color: "var(--color-text-secondary)" }}>
        {(item.props.content as string | undefined) ?? ""}
      </p>
    );
  }

  if (item.type === "inner-card") {
    return (
      <div className="rounded-md border p-4 h-full"
        style={{ ...placement, borderColor: "var(--color-bg-border)", background: "rgba(15,10,26,.58)" }}>
        <div className="space-y-3">
          {parseDraftItems(item.props.items).map((child) => (
            <DraftCardLayoutItem key={child.id} item={child} />
          ))}
        </div>
      </div>
    );
  }

  if (item.type === "image") {
    const src = item.props.src as string | undefined;
    if (!src) return null;
    return (
      <div className="min-h-36 overflow-hidden rounded-md border" style={{ ...placement, borderColor: "var(--color-bg-border)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={(item.props.alt as string | undefined) ?? ""} className={`h-full min-h-36 w-full ${item.props.fit === "contain" ? "object-contain p-3" : "object-cover"}`} />
      </div>
    );
  }

  if (item.type === "divider") {
    return <div className="h-px self-center" style={{ ...placement, background: "var(--color-bg-border)" }} />;
  }

  return null;
}

function DraftBlock({
  item,
  pathname,
  editingId,
  selectedGridItemId,
  onGridPropsChange,
  onSelectGridItem,
}: {
  item: PageItem;
  pathname: string;
  editingId: string | null;
  selectedGridItemId: string | null;
  onGridPropsChange: (newProps: Record<string, unknown>) => void;
  onSelectGridItem: (id: string | null) => void;
}) {
  if (item.kind === "section") {
    const meta = PAGE_SECTIONS[pathname]?.find((section) => section.id === item.id);
    return (
      <div data-section-id={item.id} className="max-w-6xl mx-auto px-6 py-4">
        <div className="rounded border border-dashed border-[#2a2a35] px-4 py-3 text-xs text-[#5a5060]">
          {meta?.label ?? item.id}
        </div>
      </div>
    );
  }

  const props = item.props;

  if (item.type === "page-header") {
    const align = props.align === "left" ? "text-left" : "text-center";
    return (
      <header data-block-id={item.id} data-block-type={item.type} className={`mb-14 max-w-6xl mx-auto px-6 pt-16 ${align}`}>
        {props.eyebrow ? (
          <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3" style={{ color: "var(--color-accent-arcane)" }}>
            {props.eyebrow as string}
          </p>
        ) : null}
        {props.title ? (
          <h1 className="font-cinzel text-4xl tracking-widest uppercase mb-4 shimmer-text">{props.title as string}</h1>
        ) : null}
        {props.description ? (
          <p className={props.align === "left" ? "max-w-3xl" : "max-w-2xl mx-auto"} style={{ color: "var(--color-text-secondary)" }}>
            {props.description as string}
          </p>
        ) : null}
      </header>
    );
  }

  if (item.type === "card") {
    return (
      <div data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-4">
        <div className="fantasy-card p-6">
          {props.eyebrow ? (
            <p className="font-cinzel text-xs tracking-[0.35em] uppercase mb-2" style={{ color: "var(--color-accent-arcane)" }}>
              {props.eyebrow as string}
            </p>
          ) : null}
          <h3 className="font-cinzel text-xl tracking-wider" style={{ color: "var(--color-text-primary)" }}>
            {(props.title as string | undefined) ?? "New Card"}
          </h3>
          {props.description ? (
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              {props.description as string}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (item.type === "layout-card") {
    if (editingId === item.id) {
      return (
        <section
          data-block-id={item.id}
          data-block-type={item.type}
          className="max-w-6xl mx-auto px-6 py-6"
          style={{ pointerEvents: "auto" }}
        >
          <CardLayoutGridEditor
            props={item.props}
            onPropsChange={onGridPropsChange}
            selectedId={selectedGridItemId}
            onSelect={onSelectGridItem}
          />
        </section>
      );
    }
    return (
      <section data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-6">
        <article className="fantasy-card p-5 md:p-6">
          <div className="space-y-4">
            {parseDraftItems(props.items).map((child) => (
              <DraftCardLayoutItem key={child.id} item={child} />
            ))}
          </div>
        </article>
      </section>
    );
  }

  if (item.type === "text") {
    return (
      <div data-block-id={item.id} data-block-type={item.type} className={`max-w-3xl mx-auto px-6 py-6 ${props.align === "center" ? "text-center" : ""}`}>
        <p className="text-base leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-secondary)" }}>
          {(props.content as string | undefined) ?? ""}
        </p>
      </div>
    );
  }

  if (item.type === "divider") {
    const label   = props.label as string | undefined;
    const variant = (props.variant as string | undefined) ?? "ornate";
    if (label) {
      return (
        <div data-block-id={item.id} data-block-type={item.type} className="flex items-center gap-4 py-8 max-w-6xl mx-auto px-6">
          <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
          <span className="font-cinzel text-xs tracking-[0.35em] uppercase shrink-0" style={{ color: "var(--color-text-muted)" }}>{label}</span>
          <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
        </div>
      );
    }
    if (variant === "ornate") {
      return (
        <div data-block-id={item.id} data-block-type={item.type} className="py-6 max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
            <span style={{ color: "var(--color-bg-border)", fontSize: "0.7rem" }}>✦</span>
            <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
          </div>
        </div>
      );
    }
    return (
      <div data-block-id={item.id} data-block-type={item.type} className="py-6 max-w-6xl mx-auto px-6">
        <hr style={{ borderColor: "var(--color-bg-border)" }} />
      </div>
    );
  }

  if (item.type === "section-heading") {
    const eyebrow     = props.eyebrow     as string | undefined;
    const title       = props.title       as string | undefined;
    const description = props.description as string | undefined;
    const centered    = props.align === "center";
    return (
      <section data-block-id={item.id} data-block-type={item.type} className={`max-w-6xl mx-auto px-6 py-10 ${centered ? "text-center" : ""}`}>
        {eyebrow && <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-2" style={{ color: "var(--color-accent-arcane)" }}>{eyebrow}</p>}
        {title && <h2 className="font-cinzel text-3xl tracking-widest uppercase mb-3 shimmer-text">{title}</h2>}
        {description && <p className={`text-sm leading-relaxed ${centered ? "max-w-2xl mx-auto" : "max-w-3xl"}`} style={{ color: "var(--color-text-secondary)" }}>{description}</p>}
      </section>
    );
  }

  if (item.type === "callout") {
    const title   = props.title   as string | undefined;
    const content = (props.content as string | undefined) ?? "";
    const variant = (props.variant as string | undefined) ?? "gold";
    const colorVar = variant === "arcane" ? "var(--color-accent-arcane)" : variant === "blood" ? "var(--color-accent-blood)" : "var(--color-accent-gold)";
    return (
      <div data-block-id={item.id} data-block-type={item.type} className="max-w-3xl mx-auto px-6 py-4">
        <div className="rounded-lg border-l-4 p-5" style={{ borderColor: colorVar, background: "var(--color-bg-card)" }}>
          {title && <p className="font-cinzel text-sm tracking-widest uppercase mb-2" style={{ color: colorVar }}>{title}</p>}
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{content}</p>
        </div>
      </div>
    );
  }

  if (item.type === "button-link") {
    const label   = (props.label as string | undefined) ?? "Button";
    const href    = (props.href as string | undefined) ?? "";
    const align   = (props.align as string | undefined) ?? "left";
    const variant = (props.variant as string | undefined) ?? "primary";
    const justify = align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";
    const cls   = variant === "secondary"
      ? "inline-flex items-center rounded-md border px-4 py-2 text-xs font-cinzel tracking-widest uppercase"
      : "inline-flex items-center rounded-md px-4 py-2 text-xs font-cinzel tracking-widest uppercase";
    const style = variant === "secondary"
      ? { borderColor: "var(--color-bg-border)", color: "var(--color-text-primary)" }
      : { background: "var(--color-accent-arcane)", color: "#fff" };
    return (
      <div data-block-id={item.id} data-block-type={item.type} className={`max-w-6xl mx-auto px-6 py-4 flex ${justify}`}>
        <span className={cls} style={style}>{label} {href ? "→" : ""}</span>
      </div>
    );
  }

  if (item.type === "link-list") {
    const title = props.title as string | undefined;
    let links: Array<{ label?: string; href?: string; description?: string }> = [];
    try { links = JSON.parse((props.links as string | undefined) ?? "[]"); } catch { /* */ }
    return (
      <section data-block-id={item.id} data-block-type={item.type} className="max-w-3xl mx-auto px-6 py-6">
        <div className="fantasy-card p-5">
          {title && <h2 className="font-cinzel text-xl tracking-widest uppercase mb-4" style={{ color: "var(--color-text-primary)" }}>{title}</h2>}
          <div className="space-y-3">
            {links.map((link, i) => (
              <div key={i} className="rounded-md border px-3 py-3" style={{ borderColor: "var(--color-bg-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{link.label ?? ""} →</p>
                {link.description && <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{link.description}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (item.type === "spacer") {
    const size = (props.size as string | undefined) ?? "md";
    const h = size === "sm" ? "h-8" : size === "lg" ? "h-24" : "h-16";
    return (
      <div data-block-id={item.id} data-block-type={item.type} className={`${h} max-w-6xl mx-auto px-6 flex items-center justify-center`}>
        <div className="w-full h-px border-t border-dashed" style={{ borderColor: "var(--color-bg-border)", opacity: 0.4 }} />
      </div>
    );
  }

  if (item.type === "image") {
    const src     = props.src     as string | undefined;
    const caption = props.caption as string | undefined;
    const size    = (props.size   as string | undefined) ?? "large";
    const wrapClass = size === "full" ? "w-full px-0" : size === "medium" ? "max-w-xl mx-auto px-6" : "max-w-3xl mx-auto px-6";
    return (
      <div data-block-id={item.id} data-block-type={item.type} className={`${wrapClass} py-6`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={(props.alt as string | undefined) ?? ""} className="w-full rounded-lg object-cover border" style={{ borderColor: "var(--color-bg-border)" }} />
        ) : (
          <div className="w-full aspect-video rounded-lg border flex items-center justify-center" style={{ borderColor: "var(--color-bg-border)", background: "var(--color-bg-card)" }}>
            <p className="font-cinzel text-xs tracking-widest" style={{ color: "var(--color-text-muted)" }}>No image selected</p>
          </div>
        )}
        {caption && <p className="mt-3 text-xs text-center font-cinzel tracking-wider" style={{ color: "var(--color-text-muted)" }}>{caption}</p>}
      </div>
    );
  }

  if (item.type === "gallery") {
    let images: Array<{ src?: string; alt?: string; caption?: string }> = [];
    try { images = JSON.parse((props.images as string | undefined) ?? "[]"); } catch { /* */ }
    const columns = (props.columns as string | undefined) ?? "3";
    const columnClass = columns === "4" ? "xl:grid-cols-4" : columns === "2" ? "lg:grid-cols-2" : "lg:grid-cols-3";
    return (
      <section data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-8">
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${columnClass} gap-4`}>
          {images.map((img, i) => (
            <div key={i} className="fantasy-card overflow-hidden">
              {img.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.src} alt={img.alt ?? ""} className="w-full aspect-[4/3] object-cover" />
              ) : (
                <div className="w-full aspect-[4/3] flex items-center justify-center" style={{ background: "var(--color-bg-card)" }}>
                  <p className="font-cinzel text-[10px]" style={{ color: "var(--color-text-muted)" }}>Slot {i + 1}</p>
                </div>
              )}
              {img.caption && <p className="p-3 text-xs" style={{ color: "var(--color-text-muted)" }}>{img.caption}</p>}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (item.type === "embed") {
    const src   = props.src   as string | undefined;
    const title = (props.title as string | undefined) ?? "Embedded content";
    const h     = Math.min(Math.max(parseInt((props.height as string | undefined) ?? "400", 10), 100), 800);
    return (
      <div data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-6">
        {src ? (
          <iframe src={src} title={title} width="100%" height={h} className="rounded-lg border" style={{ borderColor: "var(--color-bg-border)" }} />
        ) : (
          <div className="rounded-lg border flex items-center justify-center" style={{ height: h, borderColor: "var(--color-bg-border)", background: "var(--color-bg-card)" }}>
            <p className="font-cinzel text-xs tracking-widest" style={{ color: "var(--color-text-muted)" }}>Embed — paste a URL in the props panel</p>
          </div>
        )}
      </div>
    );
  }

  if (item.type === "portal-links") {
    const eyebrow     = props.eyebrow     as string | undefined;
    const title       = props.title       as string | undefined;
    const description = props.description as string | undefined;
    let links: Array<{ title?: string; description?: string; href?: string; label?: string }> = [];
    try { links = JSON.parse((props.links as string | undefined) ?? "[]"); } catch { /* */ }
    return (
      <section data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-12">
        {(eyebrow || title || description) && (
          <div className="text-center mb-10">
            {eyebrow && <p className="font-cinzel text-xs tracking-[0.4em] uppercase mb-2" style={{ color: "var(--color-accent-arcane)" }}>{eyebrow}</p>}
            {title && <h2 className="font-cinzel text-2xl tracking-widest uppercase mb-3 shimmer-text">{title}</h2>}
            {description && <p className="max-w-xl mx-auto text-sm" style={{ color: "var(--color-text-secondary)" }}>{description}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map((link, i) => (
            <div key={i} className="fantasy-card p-5 h-full">
              <h3 className="font-cinzel text-base mb-3" style={{ color: "var(--color-accent-gold)" }}>{link.title ?? "Link"}</h3>
              {link.description && <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--color-text-secondary)" }}>{link.description}</p>}
              {link.label && <span className="text-xs font-cinzel tracking-widest uppercase" style={{ color: "var(--color-text-muted)" }}>{link.label} →</span>}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (item.type === "founders") {
    const heading = (props.heading as string | undefined) ?? "Founded By";
    const bio = props.bio as string | undefined;
    let founders: Array<{ name?: string; role?: string; img?: string }> = [];
    try { founders = JSON.parse((props.founders as string | undefined) ?? "[]"); } catch { /* */ }
    return (
      <section data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-12">
        <div className="fantasy-card p-8 text-center">
          {heading && <p className="font-cinzel text-xs tracking-[0.35em] uppercase mb-8" style={{ color: "var(--color-text-muted)" }}>{heading}</p>}
          <div className="flex flex-wrap justify-center gap-10">
            {founders.map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                {f.img
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={f.img} alt={f.name ?? ""} className="w-20 h-20 rounded-full object-cover object-top" style={{ border: "2px solid var(--color-accent-gold)" }} />
                  : <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ border: "2px solid var(--color-accent-gold)", background: "var(--color-bg-card)" }}>
                      <span className="font-cinzel text-lg" style={{ color: "var(--color-accent-gold)" }}>{(f.name ?? "?")[0]}</span>
                    </div>
                }
                <p className="font-cinzel text-base" style={{ color: "var(--color-accent-gold)" }}>{f.name ?? ""}</p>
                <p className="text-xs tracking-widest uppercase" style={{ color: "var(--color-text-muted)" }}>{f.role ?? ""}</p>
              </div>
            ))}
          </div>
          {bio && <p className="mt-8 pt-6 text-sm leading-relaxed italic max-w-md mx-auto" style={{ borderTop: "1px solid var(--color-bg-border)", color: "var(--color-text-muted)" }}>{bio}</p>}
        </div>
      </section>
    );
  }

  if (item.type === "profile-card") {
    return (
      <section data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-6">
        <article className="fantasy-card p-5 md:p-6">
          <div className="space-y-3">
            {parseDraftItems(props.items).map((child) => (
              <DraftCardLayoutItem key={child.id} item={child} />
            ))}
          </div>
        </article>
      </section>
    );
  }

  if (item.type === "card-grid") {
    const columns = (props.columns as string | undefined) ?? "2";
    const columnClass = columns === "3" ? "sm:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2";
    return (
      <section data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-2">
        <div className={`grid grid-cols-1 ${columnClass} gap-5 rounded-lg border border-dashed px-4 py-3`} style={{ borderColor: "#2a2a35" }}>
          <p className="font-cinzel text-[10px] tracking-widest uppercase col-span-full" style={{ color: "var(--color-text-muted)" }}>
            Card Grid ({columns} columns) — place cards below
          </p>
        </div>
      </section>
    );
  }

  if (item.type === "hero-banner") {
    return (
      <div data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-6">
        <div className="rounded-lg border flex items-center justify-center py-16" style={{ borderColor: "var(--color-bg-border)", background: "var(--color-bg-card)" }}>
          <p className="font-cinzel text-xs tracking-widest uppercase" style={{ color: "var(--color-text-muted)" }}>⬛ Hero Banner — full-screen on published page</p>
        </div>
      </div>
    );
  }

  // Data blocks — can't render live data in the editor; show a clear informational placeholder
  const DATA_BLOCK_LABELS: Partial<Record<string, string>> = {
    "campaigns-grid":  "⚔  Campaigns Grid",
    "players-grid":    "👤  Players Grid",
    "dms-grid":        "🎲  Dungeon Masters Grid",
    "bestiary-grid":   "🐉  Bestiary Grid",
    "calendar-embed":  "📅  Calendar Embed",
    "campaign-card":   `⚔  Campaign Card${props.id ? ` — ${props.id}` : ""}`,
    "player-card":     `👤  Player Card${props.id ? ` — ${props.id}` : ""}`,
    "creature-card":   `🐉  Creature Card${props.name ? ` — ${props.name}` : ""}`,
  };

  const dataLabel = DATA_BLOCK_LABELS[item.type];
  if (dataLabel) {
    return (
      <div data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-3">
        <div className="rounded-lg border border-dashed px-5 py-4 flex items-center gap-3" style={{ borderColor: "#2a2a35" }}>
          <div>
            <p className="font-cinzel text-sm tracking-wide" style={{ color: "var(--color-accent-gold)" }}>{dataLabel}</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>Live data — renders from content files on published page</p>
          </div>
        </div>
      </div>
    );
  }

  const def = getAssetDef(item.type);
  return (
    <div data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-4">
      <div className="fantasy-card p-5">
        <p className="font-cinzel text-sm tracking-widest uppercase" style={{ color: "var(--color-accent-gold)" }}>
          {def?.label ?? item.type}
        </p>
      </div>
    </div>
  );
}

function DraftPagePreview({
  items,
  pathname,
  editingId,
  selectedGridItemId,
  onGridPropsChange,
  onSelectGridItem,
  grid,
}: {
  items: PageItem[];
  pathname: string;
  editingId: string | null;
  selectedGridItemId: string | null;
  onGridPropsChange: (newProps: Record<string, unknown>) => void;
  onSelectGridItem: (id: string | null) => void;
  grid: PageGridMeta | null;
}) {
  const useGrid = grid && grid.columns > 1;
  const gapCss = !grid ? "0" : grid.gap === "sm" ? "0.75rem" : grid.gap === "lg" ? "1.5rem" : "1.125rem";

  return (
    <div
      data-editor-preview="true"
      className="fixed left-0 right-[288px] top-0 bottom-0 z-[39] overflow-y-auto"
      style={{ background: "var(--color-bg-deep)" }}
    >
      <div
        className="min-h-full pb-28 pointer-events-none"
        style={useGrid ? {
          display: "grid",
          gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
          gap: gapCss,
          padding: "1.5rem 1.5rem 7rem",
          alignContent: "start",
        } : {}}
      >
        {items.map((item) => {
          const block = item.kind === "block" ? (item as BlockItem) : null;
          const isEditing = item.kind === "block" && item.id === editingId;
          return (
            <div
              key={item.id}
              style={useGrid ? {
                gridColumn: block?.col
                  ? `${block.col} / span ${block.colSpan ?? 1}`
                  : `1 / span ${grid.columns}`,
              } : {}}
              className={isEditing ? "outline outline-2 outline-[#8b5cf6] outline-offset-[-2px] rounded" : ""}
            >
              <DraftBlock
                item={item}
                pathname={pathname}
                editingId={editingId}
                selectedGridItemId={selectedGridItemId}
                onGridPropsChange={onGridPropsChange}
                onSelectGridItem={onSelectGridItem}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PageEditOverlay({ managedPaths }: { managedPaths: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PageItem[]>([]);
  const [originalItems, setOriginalItems] = useState<PageItem[]>([]);
  const [grid, setGrid] = useState<PageGridMeta | null>(null);
  const [originalGrid, setOriginalGrid] = useState<PageGridMeta | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedGridItemId, setSelectedGridItemId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<Active | null>(null);
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const hasLayout = managedPaths.includes(pathname);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch layout when the panel opens or path changes
  useEffect(() => {
    if (!hasLayout || !open) return;
    fetch(`/api/page-layout?page=${encodeURIComponent(pathname)}`)
      .then((r) => r.json())
      .then(({ items: fetched, grid: fetchedGrid }: { items: PageItem[]; grid: PageGridMeta | null }) => {
        setItems(fetched ?? []);
        setOriginalItems(fetched ?? []);
        setGrid(fetchedGrid ?? null);
        setOriginalGrid(fetchedGrid ?? null);
      })
      .catch(() => {
        const defaults = (PAGE_SECTIONS[pathname] ?? []).map((s) => ({
          kind: "section" as const,
          id: s.id,
        }));
        setItems(defaults);
        setOriginalItems(defaults);
        setGrid(null);
        setOriginalGrid(null);
      });
  }, [pathname, open, hasLayout]);

  // ── DnD ──────────────────────────────────────────────────────────────────

  function handleDragStart(e: DragStartEvent) {
    setActiveItem(e.active);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = e;
    if (!over) return;

    const data = active.data.current as DragData | undefined;
    const overId = over.id.toString();
    if (!overId.startsWith("dz::")) return;

    const dropIdx = parseInt(overId.slice(4), 10);

    if (data?.kind === "existing") {
      const fromIdx = items.findIndex((i) => itemDndId(i) === data.dndId);
      if (fromIdx === -1) return;
      const newItems = [...items];
      const [removed] = newItems.splice(fromIdx, 1);
      const insertIdx = dropIdx > fromIdx ? dropIdx - 1 : dropIdx;
      newItems.splice(insertIdx, 0, removed);
      setItems(newItems);
      setSaved(false);
    } else if (data?.kind === "new-asset") {
      const newBlock = makeBlock(data.assetType);
      const newItems = [...items];
      newItems.splice(dropIdx, 0, newBlock);
      setItems(newItems);
      setEditingId(newBlock.id);
      setSaved(false);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleDeleteBlock(id: string) {
    setItems((prev) => prev.filter((i) => !(i.kind === "block" && i.id === id)));
    if (editingId === id) setEditingId(null);
    setSaved(false);
  }

  function handleInsertBlock(type: BlockType) {
    if (insertAtIndex === null) return;
    const newBlock = makeBlock(type);
    setItems((prev) => {
      const next = [...prev];
      next.splice(insertAtIndex, 0, newBlock);
      return next;
    });
    setEditingId(newBlock.id);
    setInsertAtIndex(null);
    setSaved(false);
  }

  function handlePropsChange(props: Record<string, unknown>) {
    if (!editingId) return;
    setItems((prev) =>
      prev.map((i) =>
        i.kind === "block" && i.id === editingId ? { ...i, props } : i
      )
    );
    setSaved(false);
  }

  function handlePlacementChange(id: string, col?: number, colSpan?: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.kind === "block" && i.id === id ? { ...i, col, colSpan } : i
      )
    );
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      await savePageLayoutAction(pathname, items, grid);
      setOriginalItems([...items]);
      setOriginalGrid(grid);
      setSaved(true);
      // Re-render the RSC subtree so the page immediately reflects the new
      // layout without a full browser reload. Client state (panel open,
      // editingId, etc.) is preserved by router.refresh().
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  // ── Computed ─────────────────────────────────────────────────────────────

  const hasChanges =
    JSON.stringify(items) !== JSON.stringify(originalItems) ||
    JSON.stringify(grid) !== JSON.stringify(originalGrid);

  const editingBlock =
    editingId != null
      ? (items.find((i) => i.kind === "block" && i.id === editingId) as BlockItem | undefined) ?? null
      : null;

  // Don't render inside admin or on non-managed paths
  if (pathname.startsWith("/admin")) return null;
  if (!hasLayout) return null;

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Edit page layout"
        className="fixed z-50 flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-cinzel tracking-widest uppercase shadow-2xl backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-100"
        style={{
          bottom: "24px",
          right: open ? "304px" : "24px",
          background: open ? "var(--color-accent-arcane)" : "rgba(15, 10, 26, 0.92)",
          borderColor: open ? "var(--color-accent-arcane)" : "var(--color-bg-border)",
          color: open ? "#fff" : "var(--color-text-secondary)",
          transition: "right 0.25s ease, background 0.2s, border-color 0.2s, color 0.2s, transform 0.1s",
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          {open ? (
            <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" d="M12 4v16M4 12h16" />
          )}
        </svg>
        {open ? "Close" : "Edit Layout"}
      </button>

      {/* ── Active edit mode ── */}
      {open && (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <DraftPagePreview
            items={items}
            pathname={pathname}
            editingId={editingId}
            selectedGridItemId={selectedGridItemId}
            onGridPropsChange={handlePropsChange}
            onSelectGridItem={setSelectedGridItemId}
            grid={grid}
          />

          {/* Transparent overlay — drag handles + drop zones on the live page */}
          <PageDragLayer
            items={items}
            pathname={pathname}
            anyDragging={!!activeItem}
            editingId={editingId}
            onEditToggle={(id) => { setEditingId(id); setSelectedGridItemId(null); }}
            onDeleteBlock={handleDeleteBlock}
            onInsertAt={setInsertAtIndex}
            grid={grid}
          />

          {/* Right panel — asset library + props editor */}
          <PageEditPanel
            editingBlock={editingBlock}
            onPropsChange={handlePropsChange}
            onClearEdit={() => { setEditingId(null); setSelectedGridItemId(null); }}
            onSave={handleSave}
            pending={pending}
            saved={saved}
            hasChanges={hasChanges}
            onClose={() => setOpen(false)}
            selectedGridItemId={selectedGridItemId}
            onGridItemSelect={setSelectedGridItemId}
            grid={grid}
            onGridChange={setGrid}
            onBlockPlacementChange={handlePlacementChange}
          />

          {/* Drag preview that follows the cursor */}
          <DragOverlay dropAnimation={null}>
            {activeItem
              ? (() => {
                  const data = activeItem.data.current as DragData | undefined;

                  if (data?.kind === "new-asset") {
                    const def = getAssetDef(data.assetType);
                    if (!def) return null;
                    return (
                      <div className="flex items-center gap-3 rounded-lg border border-[#f59e0b] bg-[#0f0a1a] px-3 py-2.5 shadow-2xl w-56 opacity-95 cursor-grabbing">
                        <span className="text-base shrink-0 w-4 text-center text-[#f59e0b]">
                          {def.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#e8dfc8] truncate">
                            {def.label}
                          </p>
                          <p className="text-[10px] text-[#5a5060]">Drop to place</p>
                        </div>
                      </div>
                    );
                  }

                  if (data?.kind === "existing") {
                    const item = items.find(
                      (i) => itemDndId(i) === data.dndId
                    );
                    if (!item) return null;
                    const assetDef =
                      item.kind === "block" ? getAssetDef(item.type) : null;
                    const label =
                      item.kind === "section"
                        ? (PAGE_SECTIONS[pathname]?.find(
                            (s) => s.id === item.id
                          )?.label ?? item.id)
                        : (assetDef?.label ?? item.type);
                    return (
                      <div
                        className="flex items-center gap-3 rounded-lg border border-[#8b5cf6] bg-[#0f0a1a] px-3 py-3 shadow-2xl w-64 opacity-95 cursor-grabbing"
                        style={{
                          transform: CSS.Translate.toString(null),
                        }}
                      >
                        <span className="text-[#5a5060] text-xl">⠿</span>
                        <p className="text-sm font-medium text-[#e8dfc8]">
                          {label}
                        </p>
                      </div>
                    );
                  }

                  return null;
                })()
              : null}
          </DragOverlay>
        </DndContext>
      )}

      {insertAtIndex !== null && (
        <BlockPicker
          onPick={handleInsertBlock}
          onClose={() => setInsertAtIndex(null)}
        />
      )}
    </>
  );
}
