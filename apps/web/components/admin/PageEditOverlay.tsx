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
} from "@/lib/pageBlocks";
import { PageDragLayer } from "./PageDragLayer";
import { PageEditPanel } from "./PageEditPanel";

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

function DraftBlock({ item, pathname }: { item: PageItem; pathname: string }) {
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

  const def = getAssetDef(item.type);
  return (
    <div data-block-id={item.id} data-block-type={item.type} className="max-w-6xl mx-auto px-6 py-4">
      <div className="fantasy-card p-5">
        <p className="font-cinzel text-sm tracking-widest uppercase" style={{ color: "var(--color-accent-gold)" }}>
          {def?.label ?? item.type}
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>Unsaved draft block</p>
      </div>
    </div>
  );
}

function DraftPagePreview({ items, pathname }: { items: PageItem[]; pathname: string }) {
  return (
    <div
      data-editor-preview="true"
      className="fixed left-0 right-[288px] top-16 bottom-0 z-[39] overflow-y-auto"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <div className="min-h-full pb-28 pointer-events-none">
        {items.map((item) => (
          <DraftBlock key={item.id} item={item} pathname={pathname} />
        ))}
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<Active | null>(null);
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
      .then(({ items: fetched }: { items: PageItem[] }) => {
        setItems(fetched ?? []);
        setOriginalItems(fetched ?? []);
      })
      .catch(() => {
        const defaults = (PAGE_SECTIONS[pathname] ?? []).map((s) => ({
          kind: "section" as const,
          id: s.id,
        }));
        setItems(defaults);
        setOriginalItems(defaults);
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

  function handlePropsChange(props: Record<string, unknown>) {
    if (!editingId) return;
    setItems((prev) =>
      prev.map((i) =>
        i.kind === "block" && i.id === editingId ? { ...i, props } : i
      )
    );
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      await savePageLayoutAction(pathname, items);
      setOriginalItems([...items]);
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
    JSON.stringify(items) !== JSON.stringify(originalItems);

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
          <DraftPagePreview items={items} pathname={pathname} />

          {/* Transparent overlay — drag handles + drop zones on the live page */}
          <PageDragLayer
            items={items}
            pathname={pathname}
            anyDragging={!!activeItem}
            editingId={editingId}
            onEditToggle={(id) =>
              setEditingId((prev) => (prev === id ? null : id))
            }
            onDeleteBlock={handleDeleteBlock}
          />

          {/* Right panel — asset library + props editor */}
          <PageEditPanel
            editingBlock={editingBlock}
            onPropsChange={handlePropsChange}
            onClearEdit={() => setEditingId(null)}
            onSave={handleSave}
            pending={pending}
            saved={saved}
            hasChanges={hasChanges}
            onClose={() => setOpen(false)}
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
    </>
  );
}
