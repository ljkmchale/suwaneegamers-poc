"use client";

import { useState, useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type Active,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { savePageLayoutAction } from "@/app/admin/page-layout/actions";
import { PAGE_SECTIONS } from "@/lib/pageSections";
import {
  ASSET_TYPES,
  getAssetDef,
  type PageItem,
  type BlockItem,
  type AssetTypeDef,
  type BlockType,
} from "@/lib/pageBlocks";

// ── Drag data shape ───────────────────────────────────────────────────────────

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

// ── Prop editor ───────────────────────────────────────────────────────────────

function PropsForm({
  block,
  onChange,
}: {
  block: BlockItem;
  onChange: (props: Record<string, unknown>) => void;
}) {
  const def = getAssetDef(block.type);
  if (!def || def.fields.length === 0)
    return (
      <p className="text-[10px] text-[#5a5060] py-1">
        No configurable properties for this block.
      </p>
    );

  function set(key: string, value: string) {
    onChange({ ...block.props, [key]: value });
  }

  const INPUT =
    "w-full px-2.5 py-1.5 rounded border text-xs bg-[#08050f] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors border-[#2a2a35]";
  const LABEL =
    "block mb-1 text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060]";

  return (
    <div className="space-y-3 pt-2">
      {def.fields.map((field) => {
        const val = (block.props[field.key] as string) ?? "";
        if (field.type === "select") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              <select
                value={val}
                onChange={(e) => set(field.key, e.target.value)}
                className={INPUT}
              >
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        if (field.type === "textarea" || field.type === "json") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              {field.hint && (
                <p className="text-[10px] text-[#5a5060] mb-1">{field.hint}</p>
              )}
              <textarea
                rows={field.type === "json" ? 5 : 3}
                value={val}
                placeholder={field.placeholder}
                onChange={(e) => set(field.key, e.target.value)}
                className={`${INPUT} resize-y font-mono`}
              />
            </div>
          );
        }
        return (
          <div key={field.key}>
            <label className={LABEL}>{field.label}</label>
            <input
              type={field.type === "url" ? "url" : "text"}
              value={val}
              placeholder={field.placeholder}
              onChange={(e) => set(field.key, e.target.value)}
              className={INPUT}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Drop zone (between blocks on the canvas) ──────────────────────────────────

function DropZone({ id, active }: { id: string; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`my-1 flex items-center justify-center rounded-lg border-2 border-dashed font-cinzel text-[10px] tracking-widest uppercase transition-all duration-150 ${
        isOver
          ? "h-14 border-[#8b5cf6] bg-[#8b5cf6]/10 text-[#8b5cf6]"
          : active
          ? "h-8 border-[#2a2a35] text-[#3a3a45] hover:border-[#3a3a45]"
          : "h-1 border-transparent"
      }`}
    >
      {isOver && "Drop here"}
    </div>
  );
}

// ── Draggable block card (existing item on the canvas) ────────────────────────

function BlockCard({
  item,
  pathname,
  expanded,
  onToggle,
  onDelete,
  onPropsChange,
  anyDragging,
}: {
  item: PageItem;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onPropsChange: (props: Record<string, unknown>) => void;
  anyDragging: boolean;
}) {
  const dndId = itemDndId(item);
  const isSection = item.kind === "section";
  const sectionMeta = isSection
    ? PAGE_SECTIONS[pathname]?.find((s) => s.id === item.id)
    : null;
  const assetDef = !isSection ? getAssetDef((item as BlockItem).type) : null;

  const label = isSection
    ? (sectionMeta?.label ?? item.id)
    : (assetDef?.label ?? (item as BlockItem).type);
  const sub = isSection
    ? (sectionMeta?.description ?? "Built-in section")
    : (assetDef?.description ?? "");
  const icon = isSection ? "⊞" : (assetDef?.icon ?? "□");

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: dndId,
      data: { kind: "existing", dndId } satisfies DragData,
    });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
        transition: isDragging ? undefined : "opacity 0.15s",
      }}
    >
      <div
        className={`flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
          expanded
            ? "border-[#8b5cf6] bg-[#16161e]"
            : "border-[#2a2a35] bg-[#0f0a1a] hover:border-[#3a3a45]"
        } ${anyDragging ? "pointer-events-none" : ""}`}
      >
        {/* Drag handle */}
        <span
          className="cursor-grab active:cursor-grabbing text-[#3a3a45] hover:text-[#5a5060] select-none text-xl shrink-0 transition-colors"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⠿
        </span>

        {/* Icon */}
        <span
          className="text-base shrink-0 w-5 text-center"
          style={{
            color: isSection
              ? "var(--color-accent-arcane)"
              : "var(--color-accent-gold)",
          }}
        >
          {icon}
        </span>

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-[#e8dfc8]">{label}</p>
          <p className="text-[10px] truncate text-[#5a5060]">{sub}</p>
        </div>

        {/* Actions — blocks only */}
        {!isSection && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggle}
              title="Edit properties"
              className="w-7 h-7 flex items-center justify-center rounded text-[#5a5060] hover:text-[#8b5cf6] hover:bg-[#1a1a2a] transition-colors text-sm"
            >
              ✎
            </button>
            <button
              onClick={onDelete}
              title="Remove block"
              className="w-7 h-7 flex items-center justify-center rounded text-[#5a5060] hover:text-[#ef4444] hover:bg-[#1a1a2a] transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Inline props editor */}
      {expanded && !isSection && (
        <div className="mx-1 mb-1 rounded-b-lg border border-t-0 border-[#8b5cf6] bg-[#08050f] px-4 py-3">
          <PropsForm
            block={item as BlockItem}
            onChange={onPropsChange}
          />
        </div>
      )}
    </div>
  );
}

// ── Draggable asset tile (from the library panel) ─────────────────────────────

function AssetTile({ def }: { def: AssetTypeDef }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new-asset::${def.type}`,
    data: { kind: "new-asset", assetType: def.type } satisfies DragData,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-3 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-3 py-2.5 cursor-grab active:cursor-grabbing hover:border-[#f59e0b] hover:bg-[#16161e] transition-colors select-none ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <span className="text-base shrink-0 w-5 text-center text-[#f59e0b]">
        {def.icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#e8dfc8] truncate">{def.label}</p>
        <p className="text-[10px] text-[#5a5060] truncate">{def.description}</p>
      </div>
      <span className="ml-auto text-[#3a3a45] text-xs shrink-0">⠿</span>
    </div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export function PageEditOverlay({ managedPaths }: { managedPaths: string[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PageItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<Active | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const hasLayout = managedPaths.includes(pathname);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch layout when panel opens or path changes
  useEffect(() => {
    if (!hasLayout || !open) return;
    fetch(`/api/page-layout?page=${encodeURIComponent(pathname)}`)
      .then((r) => r.json())
      .then(({ items: fetched }: { items: PageItem[] }) =>
        setItems(fetched ?? [])
      )
      .catch(() => {
        const defaults = (PAGE_SECTIONS[pathname] ?? []).map((s) => ({
          kind: "section" as const,
          id: s.id,
        }));
        setItems(defaults);
      });
  }, [pathname, open, hasLayout]);

  // ── DnD handlers ─────────────────────────────────────────────────────────

  function handleDragStart(e: DragStartEvent) {
    setActiveItem(e.active);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = e;
    if (!over) return;

    const data = active.data.current as DragData | undefined;
    const overId = over.id.toString();

    // Only drop zones are valid targets
    if (!overId.startsWith("dz::")) return;
    const dropIdx = parseInt(overId.slice(4), 10);

    if (data?.kind === "existing") {
      // Move an existing block / section to a new position
      const fromIdx = items.findIndex((i) => itemDndId(i) === data.dndId);
      if (fromIdx === -1) return;
      const newItems = [...items];
      const [removed] = newItems.splice(fromIdx, 1);
      // After removing, the effective insert index shifts down if we moved right
      const insertIdx = dropIdx > fromIdx ? dropIdx - 1 : dropIdx;
      newItems.splice(insertIdx, 0, removed);
      setItems(newItems);
    } else if (data?.kind === "new-asset") {
      // Insert a brand-new block at the drop position
      const newBlock = makeBlock(data.assetType);
      setItems((prev) => {
        const next = [...prev];
        next.splice(dropIdx, 0, newBlock);
        return next;
      });
      setEditingId(newBlock.id);
    }
  }

  function handleSave() {
    startTransition(async () => {
      await savePageLayoutAction(pathname, items);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setOpen(false);
      }, 1200);
    });
  }

  // Don't render in admin or on non-managed paths
  if (pathname.startsWith("/admin")) return null;
  if (!hasLayout) return null;

  const pageTitle =
    pathname === "/"
      ? "Home"
      : pathname
          .replace(/^\//, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

  // Group assets by category for the right panel
  const assetCategories: { label: string; key: "layout" | "content" | "data" }[] = [
    { label: "Layout", key: "layout" },
    { label: "Content", key: "content" },
    { label: "Data", key: "data" },
  ];

  const byCategory = {
    layout: ASSET_TYPES.filter((a) => a.category === "layout"),
    content: ASSET_TYPES.filter((a) => a.category === "content"),
    data: ASSET_TYPES.filter((a) => a.category === "data"),
  };

  const anyDragging = !!activeItem;

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Edit page layout"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-cinzel tracking-widest uppercase shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-100"
        style={{
          background: open
            ? "var(--color-accent-arcane)"
            : "rgba(15, 10, 26, 0.92)",
          borderColor: open
            ? "var(--color-accent-arcane)"
            : "var(--color-bg-border)",
          color: open ? "#fff" : "var(--color-text-secondary)",
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

      {/* ── Full-screen page builder ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex flex-col"
          style={{
            background: "rgba(8, 5, 15, 0.97)",
            backdropFilter: "blur(14px)",
          }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* ── Header ── */}
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#2a2a35]">
              <div>
                <p className="font-cinzel text-[10px] tracking-[0.4em] uppercase text-[#8b5cf6] mb-0.5">
                  Page Builder
                </p>
                <p className="font-cinzel text-lg tracking-wider text-[#e8dfc8]">
                  {pageTitle}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {saved && (
                  <p className="text-xs text-green-400 font-cinzel tracking-widest">
                    Saved ✓
                  </p>
                )}
                <button
                  onClick={handleSave}
                  disabled={pending}
                  className="px-5 py-2 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save Layout"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-[#2a2a35] text-[#5a5060] hover:text-[#e8dfc8] hover:border-[#5a5060] transition-colors text-xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 flex overflow-hidden">
              {/* ── Left: layout canvas ── */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <p className="text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060] mb-5">
                  ← Drag assets from the right panel and drop them into position
                </p>

                {/* Top drop zone */}
                <DropZone id="dz::0" active={anyDragging} />

                {items.length === 0 ? (
                  <div
                    className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-20 transition-all ${
                      anyDragging
                        ? "border-[#8b5cf6] bg-[#8b5cf6]/5"
                        : "border-[#2a2a35]"
                    }`}
                  >
                    <p className="text-[#5a5060] text-sm font-cinzel tracking-widest uppercase mb-2">
                      Empty page
                    </p>
                    <p className="text-[#3a3a45] text-xs">
                      Drag blocks from the panel on the right
                    </p>
                  </div>
                ) : (
                  items.map((item, i) => (
                    <div key={itemDndId(item)}>
                      <BlockCard
                        item={item}
                        pathname={pathname}
                        expanded={
                          item.kind === "block" && editingId === item.id
                        }
                        onToggle={() => {
                          if (item.kind === "block")
                            setEditingId((prev) =>
                              prev === item.id ? null : item.id
                            );
                        }}
                        onDelete={() => {
                          if (item.kind === "block") {
                            setItems((prev) =>
                              prev.filter(
                                (x) => !(x.kind === "block" && x.id === item.id)
                              )
                            );
                            if (editingId === item.id) setEditingId(null);
                          }
                        }}
                        onPropsChange={(props) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.kind === "block" &&
                              x.id === (item as BlockItem).id
                                ? { ...x, props }
                                : x
                            )
                          )
                        }
                        anyDragging={anyDragging}
                      />
                      {/* Drop zone after each item */}
                      <DropZone id={`dz::${i + 1}`} active={anyDragging} />
                    </div>
                  ))
                )}
              </div>

              {/* ── Right: asset library ── */}
              <div
                className="w-72 shrink-0 border-l border-[#2a2a35] overflow-y-auto flex flex-col"
                style={{ background: "rgba(15, 10, 26, 0.8)" }}
              >
                <div className="px-5 py-5">
                  <p className="font-cinzel text-xs tracking-widest uppercase text-[#a89880] mb-1">
                    Assets
                  </p>
                  <p className="text-[10px] text-[#5a5060] mb-5">
                    Drag a block onto the canvas to place it
                  </p>

                  {assetCategories.map(({ label, key }) => (
                    <div key={key} className="mb-6">
                      <p className="text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060] mb-2 px-0.5">
                        {label}
                      </p>
                      <div className="space-y-1.5">
                        {byCategory[key].map((def) => (
                          <AssetTile key={def.type} def={def} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Drag preview overlay ── */}
            <DragOverlay dropAnimation={null}>
              {activeItem
                ? (() => {
                    const data = activeItem.data.current as DragData | undefined;

                    if (data?.kind === "new-asset") {
                      const def = getAssetDef(data.assetType);
                      if (!def) return null;
                      return (
                        <div className="flex items-center gap-3 rounded-lg border border-[#f59e0b] bg-[#0f0a1a] px-3 py-2.5 shadow-2xl w-64 opacity-95 cursor-grabbing">
                          <span className="text-base shrink-0 w-5 text-center text-[#f59e0b]">
                            {def.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#e8dfc8] truncate">
                              {def.label}
                            </p>
                            <p className="text-[10px] text-[#5a5060]">
                              Drop to place
                            </p>
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
                        item.kind === "block"
                          ? getAssetDef(item.type)
                          : null;
                      const sectionMeta =
                        item.kind === "section"
                          ? PAGE_SECTIONS[pathname]?.find(
                              (s) => s.id === item.id
                            )
                          : null;
                      const label =
                        item.kind === "section"
                          ? (sectionMeta?.label ?? item.id)
                          : (assetDef?.label ?? item.type);
                      const icon =
                        item.kind === "section"
                          ? "⊞"
                          : (assetDef?.icon ?? "□");
                      return (
                        <div className="flex items-center gap-3 rounded-lg border border-[#8b5cf6] bg-[#0f0a1a] px-3 py-3 shadow-2xl w-80 opacity-95 cursor-grabbing">
                          <span className="text-[#3a3a45] text-xl select-none">
                            ⠿
                          </span>
                          <span
                            className="text-base w-5 text-center shrink-0"
                            style={{
                              color:
                                item.kind === "section"
                                  ? "var(--color-accent-arcane)"
                                  : "var(--color-accent-gold)",
                            }}
                          >
                            {icon}
                          </span>
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
        </div>
      )}
    </>
  );
}
