"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PAGE_SECTIONS } from "@/lib/pageSections";
import { getAssetDef } from "@/lib/pageBlocks";
import type { PageItem, PageGridMeta, BlockItem } from "@/lib/pageBlocks";

// ── Measured position of a DOM element ───────────────────────────────────────

interface MeasuredEl {
  rawId: string;           // value of data-block-id or data-section-id
  kind: "section" | "block";
  top: number;             // viewport-relative (fixed positioning)
  bottom: number;
  left: number;
  width: number;
  height: number;
}

// ── Page-level resize handle ─────────────────────────────────────────────────

function PageResizeHandle({
  dir,
  show,
  onPointerDown,
}: {
  dir: "col" | "row" | "both";
  show: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onPointerDown(e); }}
      style={{
        position: "absolute",
        zIndex: 20,
        background: "#8b5cf6",
        opacity: show ? 1 : 0,
        transition: "opacity 0.15s",
        boxShadow: show ? "0 0 6px rgba(139,92,246,0.8)" : "none",
        ...(dir === "col"
          ? { right: 0, top: "15%", width: 8, height: "70%", cursor: "ew-resize", borderRadius: "3px 0 0 3px" }
          : dir === "row"
          ? { bottom: 0, left: "15%", height: 8, width: "70%", cursor: "ns-resize", borderRadius: "3px 3px 0 0" }
          : { right: 0, bottom: 0, width: 14, height: 14, cursor: "nwse-resize", borderRadius: "4px 0 0 0" }),
      }}
    />
  );
}

// ── Drop zone strip (between elements) ───────────────────────────────────────

function DropZone({
  id,
  top,
  bottom,
  lineY,
  left = 0,
  right = 288,
  anyDragging,
  onInsertAt,
}: {
  id: string;
  top: number;
  bottom: number;
  lineY: number;
  left?: number;
  right?: number;
  anyDragging: boolean;
  onInsertAt?: (index: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [hovered, setHovered] = useState(false);

  function handleClick() {
    if (anyDragging || !onInsertAt) return;
    const idx = parseInt(id.split("::")[1] ?? "0", 10);
    onInsertAt(idx);
  }
  const lineOffset = lineY - top;

  // Always occupy a thin strip around the insertion line so it's hoverable
  const idleHeight = 20;
  const activeHeight = Math.max(bottom - top, 4);
  const zoneHeight = anyDragging ? activeHeight : idleHeight;
  const zoneTop = anyDragging ? top : lineY - idleHeight / 2;

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      style={{
        position: "fixed",
        left,
        right,
        top: zoneTop,
        height: zoneHeight,
        pointerEvents: "auto",
        zIndex: 42,
        background: isOver ? "rgba(139,92,246,0.06)" : "transparent",
        transition: "background 0.1s",
        cursor: anyDragging ? "default" : "pointer",
      }}
    >
      {/* Persistent insertion line — always visible */}
      <div
        className="absolute inset-x-0 pointer-events-none transition-all duration-100"
        style={{
          top: anyDragging ? Math.max(lineOffset, 0) : idleHeight / 2 - 1,
          height: isOver ? 2 : 1,
          background: isOver
            ? "#8b5cf6"
            : hovered
            ? "rgba(245,158,11,0.6)"
            : "rgba(255,255,255,0.12)",
          boxShadow: isOver ? "0 0 10px rgba(139,92,246,0.6)" : "none",
          transition: "background 0.12s, box-shadow 0.12s",
        }}
      />

      {/* "+" pill — shown on hover when not dragging */}
      {!anyDragging && hovered && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-0.5 rounded-full font-cinzel text-[9px] tracking-widest uppercase pointer-events-none"
          style={{
            top: idleHeight / 2,
            background: "rgba(15,10,26,0.92)",
            border: "1px solid rgba(245,158,11,0.5)",
            color: "#f59e0b",
            whiteSpace: "nowrap",
          }}
        >
          + insert block
        </div>
      )}

      {/* "Drop here" pill — shown during drag when over */}
      {anyDragging && isOver && (
        <div
          className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full font-cinzel text-[10px] tracking-widest uppercase text-white pointer-events-none z-10"
          style={{
            top: Math.max(lineOffset - 14, 2),
            background: "#8b5cf6",
            boxShadow: "0 0 20px rgba(139,92,246,0.6)",
          }}
        >
          Drop here
        </div>
      )}
    </div>
  );
}

// ── Block handle — Google Sites-style selection outline + floating toolbar ──────

function BlockHandle({
  item,
  measured,
  pathname,
  onDelete,
  editingId,
  onEditToggle,
  isSelected,
  onSelect,
  anyDragging,
  grid,
  onPlacementChange,
  onResizeStart,
  isResizing,
}: {
  item: PageItem;
  measured: MeasuredEl;
  pathname: string;
  onDelete: () => void;
  editingId: string | null;
  onEditToggle: () => void;
  isSelected: boolean;
  onSelect: () => void;
  anyDragging: boolean;
  grid?: PageGridMeta | null;
  onPlacementChange?: (id: string, col?: number, colSpan?: number, row?: number, rowSpan?: number) => void;
  onResizeStart?: (e: React.PointerEvent, id: string, dir: "col" | "row" | "both") => void;
  isResizing?: boolean;
}) {
  // Hover state is only used for sections (blocks use click-to-select instead)
  const [isSectionHovering, setIsSectionHovering] = useState(false);

  const dndId = item.kind === "section" ? `section::${item.id}` : item.id;
  const isSection = item.kind === "section";

  const assetDef = !isSection ? getAssetDef((item as { type: string }).type as Parameters<typeof getAssetDef>[0]) : null;
  const sectionMeta = isSection ? PAGE_SECTIONS[pathname]?.find((s) => s.id === item.id) : null;
  const label = isSection ? (sectionMeta?.label ?? item.id) : (assetDef?.label ?? (item as { type: string }).type);
  const icon = isSection ? "⊞" : (assetDef?.icon ?? "□");

  const isEditing = !isSection && editingId === item.id;

  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `handle::${dndId}`,
    data: { kind: "existing", dndId },
  });

  const isActive = isEditing || isSelected || isDragging;
  const borderColor = isEditing ? "#8b5cf6" : "#f59e0b";
  const TOOLBAR_H = 34;
  // Show toolbar above the block when there's room; otherwise inside at the top
  const toolbarAbove = measured.top > TOOLBAR_H + 8;

  return (
    <div
      ref={setNodeRef}
      {...(isSection ? {} : attributes)}
      {...(isSection ? {} : listeners)}
      onMouseEnter={isSection ? () => setIsSectionHovering(true) : undefined}
      onMouseLeave={isSection ? () => setIsSectionHovering(false) : undefined}
      onClick={!isSection ? onSelect : undefined}
      style={{
        position: "fixed",
        top: measured.top,
        left: measured.left,
        width: measured.width,
        height: Math.max(measured.height, 32),
        transform: CSS.Translate.toString(transform),
        // Above drop zones (42) when idle so thin blocks (dividers) are clickable.
        // Below drop zones when any drag is active so drops land correctly.
        zIndex: anyDragging ? 39 : 43,
        pointerEvents: isEditing ? "none" : "auto",
        opacity: isDragging ? 0.15 : 1,
        // Selection outline — amber on click/select, arcane when editing
        outline: isActive && !isSection ? `2px solid ${borderColor}` : "2px solid transparent",
        outlineOffset: "-1px",
        borderRadius: "4px",
        cursor: isSection ? "default" : isDragging ? "grabbing" : "pointer",
        transition: "outline-color 0.12s",
        background: isEditing ? "rgba(139,92,246,0.04)" : "transparent",
      }}
    >
      {/* ── Floating toolbar for blocks ── */}
      {!isSection && (
        <div
          style={{
            position: "absolute",
            top: toolbarAbove ? -(TOOLBAR_H + 6) : 4,
            left: 0,
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: "2px",
            padding: "2px 6px",
            borderRadius: "6px",
            border: "1px solid #2a2a35",
            background: "#08050f",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            whiteSpace: "nowrap",
            opacity: isActive ? 1 : 0,
            pointerEvents: isActive ? "auto" : "none",
            transition: "opacity 0.12s",
          }}
        >
          {/* Drag grip indicator (decorative — entire block is draggable) */}
          <span
            style={{ fontSize: "14px", color: "#5a5060", padding: "2px 3px", lineHeight: 1, cursor: "grab" }}
            title="Drag to reorder"
          >
            ⠿
          </span>

          <div style={{ width: 1, height: 14, background: "#2a2a35", margin: "0 3px" }} />

          {/* Icon + label */}
          <span style={{ fontSize: "12px", color: borderColor, lineHeight: 1 }}>{icon}</span>
          <span style={{ fontSize: "11px", fontWeight: 500, color: "#e8dfc8", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", margin: "0 2px" }}>
            {label}
          </span>

          <div style={{ width: 1, height: 14, background: "#2a2a35", margin: "0 3px" }} />

          {/* Edit */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEditToggle(); }}
            style={{
              width: 26, height: 26,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4, fontSize: 14, lineHeight: 1,
              color: isEditing ? "#8b5cf6" : "rgba(255,255,255,0.45)",
              background: "transparent", border: "none", cursor: "pointer",
            }}
            title="Edit block"
          >
            ✎
          </button>

          {/* Delete */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{
              width: 26, height: 26,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4, fontSize: 16, lineHeight: 1,
              color: "rgba(255,255,255,0.35)",
              background: "transparent", border: "none", cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            title="Remove block"
          >
            ×
          </button>

          {/* Grid span controls — only shown when selected in an active page grid */}
          {isSelected && !isSection && grid && grid.columns > 1 && onPlacementChange && (() => {
            const block = item as import("@/lib/pageBlocks").BlockItem;
            const colSpan = block.colSpan ?? 1;
            const rowSpan = block.rowSpan ?? 1;
            const col     = block.col ?? 1;
            const row     = block.row ?? 1;
            const maxColSpan = grid.columns - col + 1;
            const maxRowSpan = grid.rows ? grid.rows - row + 1 : 6;

            const spanBtn = (label: string, disabled: boolean, onClick: () => void, title: string) => (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                disabled={disabled}
                title={title}
                style={{
                  width: 16, height: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, lineHeight: 1, border: "none", borderRadius: 2,
                  background: "rgba(255,255,255,0.07)",
                  color: disabled ? "#3a3a45" : "#a89880",
                  cursor: disabled ? "default" : "pointer",
                  padding: 0,
                }}
              >
                {label}
              </button>
            );

            return (
              <>
                <div style={{ width: 1, height: 14, background: "#2a2a35", margin: "0 3px" }} />
                {/* Col span */}
                {spanBtn("←", colSpan <= 1, () => onPlacementChange(item.id, col, colSpan - 1, block.row, block.rowSpan), "Shrink column span")}
                <span style={{ fontSize: 8, color: "#a89880", minWidth: 18, textAlign: "center", lineHeight: 1 }} title={`${colSpan} col${colSpan > 1 ? "s" : ""}`}>
                  {colSpan}c
                </span>
                {spanBtn("→", colSpan >= maxColSpan, () => onPlacementChange(item.id, col, colSpan + 1, block.row, block.rowSpan), "Expand column span")}
                {/* Row span — only if rows are defined */}
                {grid.rows && grid.rows > 1 && (
                  <>
                    <div style={{ width: 1, height: 14, background: "#2a2a35", margin: "0 2px" }} />
                    {spanBtn("↑", rowSpan <= 1, () => onPlacementChange(item.id, col, block.colSpan, row, rowSpan - 1), "Shrink row span")}
                    <span style={{ fontSize: 8, color: "#a89880", minWidth: 18, textAlign: "center", lineHeight: 1 }} title={`${rowSpan} row${rowSpan > 1 ? "s" : ""}`}>
                      {rowSpan}r
                    </span>
                    {spanBtn("↓", rowSpan >= maxRowSpan, () => onPlacementChange(item.id, col, block.colSpan, row, rowSpan + 1), "Expand row span")}
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Section hover label ── */}
      {isSection && (isSectionHovering || isDragging) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 12px",
            background: "rgba(139,92,246,0.06)",
            borderRadius: 4,
          }}
        >
          <span
            {...attributes}
            {...listeners}
            style={{ cursor: "grab", fontSize: 14, color: "#8b5cf6" }}
          >
            ⠿
          </span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.3em", textTransform: "uppercase", color: "#8b5cf6" }}>
            {label}
          </span>
        </div>
      )}

      {/* Resize handles — visible when block is selected in a multi-column grid */}
      {!isSection && isSelected && !isEditing && grid && grid.columns > 1 && onResizeStart && (
        <>
          <PageResizeHandle dir="col"  show onPointerDown={(e) => onResizeStart(e, item.id, "col")} />
          {grid.rows && grid.rows > 1 && (
            <>
              <PageResizeHandle dir="row"  show onPointerDown={(e) => onResizeStart(e, item.id, "row")} />
              <PageResizeHandle dir="both" show onPointerDown={(e) => onResizeStart(e, item.id, "both")} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Main drag layer ───────────────────────────────────────────────────────────

export function PageDragLayer({
  items,
  pathname,
  anyDragging,
  editingId,
  onEditToggle,
  onDeleteBlock,
  onInsertAt,
  onPlacementChange,
  grid,
}: {
  items: PageItem[];
  pathname: string;
  anyDragging: boolean;
  editingId: string | null;
  onEditToggle: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onInsertAt?: (index: number) => void;
  onPlacementChange?: (id: string, col?: number, colSpan?: number, row?: number, rowSpan?: number) => void;
  grid?: PageGridMeta | null;
}) {
  const [measured, setMeasured] = useState<MeasuredEl[]>([]);
  const [rowBoundaries, setRowBoundaries] = useState<{ top: number; height: number }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const resizingRef = useRef<{
    itemId: string;
    dir: "col" | "row" | "both";
    startColSpan: number;
    startRowSpan: number;
    startX: number;
    startY: number;
    cellW: number;
    cellH: number;
  } | null>(null);

  const latestRef = useRef<{
    items: PageItem[];
    measured: MeasuredEl[];
    grid: PageGridMeta | null | undefined;
    onPlacementChange: typeof onPlacementChange;
  }>({ items: [], measured: [], grid: null, onPlacementChange: undefined });
  latestRef.current = { items, measured, grid, onPlacementChange };

  // Stable global pointer handlers for resize drags
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!resizingRef.current) return;
      const { itemId, dir, startColSpan, startRowSpan, startX, startY, cellW, cellH } = resizingRef.current;
      const { items, onPlacementChange } = latestRef.current;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newColSpan = startColSpan;
      let newRowSpan = startRowSpan;
      if (dir === "col" || dir === "both") newColSpan = Math.max(1, startColSpan + Math.round(dx / cellW));
      if (dir === "row" || dir === "both") newRowSpan = Math.max(1, startRowSpan + Math.round(dy / cellH));

      const block = items.find((i) => i.id === itemId) as BlockItem | undefined;
      if (!block) return;
      if (newColSpan === (block.colSpan ?? 1) && newRowSpan === (block.rowSpan ?? 1)) return;

      onPlacementChange?.(itemId, block.col, newColSpan, block.row, newRowSpan);
    }

    function onPointerUp() {
      if (resizingRef.current) {
        resizingRef.current = null;
        setIsResizing(false);
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  function handleResizeStart(e: React.PointerEvent, itemId: string, dir: "col" | "row" | "both") {
    const block = items.find((i) => i.id === itemId) as BlockItem | undefined;
    const m = measured.find((m) => m.rawId === itemId);
    if (!block || !m || !grid) return;

    const colSpan = block.colSpan ?? 1;
    const rowSpan = block.rowSpan ?? 1;
    // Estimate cell size: use page content width divided by column count for accuracy
    const contentW = window.innerWidth - 288;
    const cellW = contentW / grid.columns;
    const cellH = m.height / rowSpan;

    resizingRef.current = { itemId, dir, startColSpan: colSpan, startRowSpan: rowSpan, startX: e.clientX, startY: e.clientY, cellW, cellH };
    setIsResizing(true);
    setSelectedId(itemId);
  }

  // Click anywhere (capture phase, runs before block onClick) → clear selection.
  // The block's own onClick then re-selects itself, so net result: clicked block is selected.
  useEffect(() => {
    function dismiss() { setSelectedId(null); }
    document.addEventListener("click", dismiss, true);
    return () => document.removeEventListener("click", dismiss, true);
  }, []);

  // Escape (capture phase — fires before KeyboardSensor on focused BlockHandle) → clear selection.
  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedId(null);
    }
    document.addEventListener("keydown", onEscape, true);
    return () => document.removeEventListener("keydown", onEscape, true);
  }, []);

  // Clear selection whenever the editing state changes
  useEffect(() => { setSelectedId(null); }, [editingId]);

  const remeasure = useCallback(() => {
    const result: MeasuredEl[] = [];
    const previewRoot = document.querySelector<HTMLElement>("[data-editor-preview='true']");
    const root = previewRoot ?? document;
    root
      .querySelectorAll<HTMLElement>("[data-block-id], [data-section-id]")
      .forEach((el) => {
        const blockId = el.getAttribute("data-block-id");
        const sectionId = el.getAttribute("data-section-id");
        const blockType = el.getAttribute("data-block-type");
        // Thin blocks (divider) carry most of their height in CSS padding on the
        // outer wrapper, not in the firstElementChild content. Measure the outer
        // element directly so the BlockHandle covers the full clickable area.
        const isThinBlock = blockType === "divider";
        const child = !isThinBlock && el.firstElementChild;
        const measureEl = child instanceof HTMLElement ? child : el;
        const rect = measureEl.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return; // skip invisible
        const visibleRight = Math.min(rect.right, window.innerWidth - 304);
        const visibleWidth = Math.max(48, visibleRight - rect.left);
        const bottom =
          blockType === "card-grid" ? rect.top + Math.min(rect.height, 32) : rect.bottom;
        result.push({
          rawId: blockId ?? sectionId!,
          kind: blockId ? "block" : "section",
          top: rect.top,
          bottom,
          left: rect.left,
          width: visibleWidth,
          height: rect.height,
        });
      });
    setMeasured(result);

    // Measure row boundaries from the grid container's direct children.
    // Each child is a block wrapper div with gridRow/gridColumn applied.
    // Group by rounded top Y to find each row's extent.
    if (grid?.rows && grid.rows > 1 && previewRoot) {
      const gridEl = previewRoot.firstElementChild;
      if (gridEl) {
        const rowMap = new Map<number, number>(); // roundedTop → maxBottom
        Array.from(gridEl.children).forEach((child) => {
          const rect = (child as HTMLElement).getBoundingClientRect();
          if (rect.height === 0) return;
          const top = Math.round(rect.top);
          rowMap.set(top, Math.max(rowMap.get(top) ?? 0, Math.round(rect.bottom)));
        });
        setRowBoundaries(
          Array.from(rowMap.entries())
            .map(([top, bottom]) => ({ top, height: bottom - top }))
            .sort((a, b) => a.top - b.top)
        );
      } else {
        setRowBoundaries([]);
      }
    } else {
      setRowBoundaries([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid?.rows]);

  // Initial measure + track scroll / resize
  useEffect(() => {
    const initialMeasure = window.setTimeout(remeasure, 0);
    window.addEventListener("scroll", remeasure, { passive: true });
    window.addEventListener("resize", remeasure);
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.documentElement);

    // The editor preview is a fixed overflow-y-auto div — its scroll doesn't
    // bubble to window, so we attach a listener directly to it.
    const preview = document.querySelector<HTMLElement>("[data-editor-preview='true']");
    preview?.addEventListener("scroll", remeasure, { passive: true });

    return () => {
      window.clearTimeout(initialMeasure);
      window.removeEventListener("scroll", remeasure);
      window.removeEventListener("resize", remeasure);
      ro.disconnect();
      preview?.removeEventListener("scroll", remeasure);
    };
  }, [remeasure]);

  // Re-measure when items change (DOM shifts when blocks are added/removed)
  useEffect(() => {
    const t = setTimeout(remeasure, 80);
    return () => clearTimeout(t);
  }, [items, remeasure]);

  // Build an id → item map
  const itemById = new Map<string, PageItem>();
  items.forEach((item) => itemById.set(item.id, item));

  if (measured.length === 0) return null;

  // Compute full-coverage drop zones. Zone i → insert at index i (before element i).
  // Each zone spans from the midpoint of the element above it to the midpoint of the
  // element below it, so the entire page height is covered with no dead spots.
  const viewportH = window.innerHeight;
  const NAV_HEIGHT = 64; // matches Navbar h-16
  const midOf = (el: MeasuredEl) => (el.top + el.bottom) / 2;

  const measuredItems = measured
    .map((el) => ({ el, itemIndex: items.findIndex((item) => item.id === el.rawId) }))
    .filter(({ itemIndex }) => itemIndex >= 0);

  const zones = measuredItems.map(({ el }, i) => {
    const previous = measuredItems[i - 1]?.el;
    const isGridCard = el.kind === "block" && el.width < window.innerWidth - 360;
    const bandTop = i === 0 || !previous ? NAV_HEIGHT : midOf(previous);
    return {
      id: `dz::${items.findIndex((item) => item.id === el.rawId)}`,
      top: isGridCard ? el.top : bandTop,
      bottom: isGridCard ? el.bottom : midOf(el),
      lineY: el.top, // insertion line drawn at the top edge of element i
      left: isGridCard ? el.left : 0,
      right: isGridCard ? Math.max(window.innerWidth - el.left - el.width, 288) : 288,
    };
  });
  // Final zone: insert after the last element
  const lastEl = measuredItems[measuredItems.length - 1]?.el;
  if (!lastEl) return null;
  zones.push({
    id: `dz::${items.length}`,
    top: midOf(lastEl),
    bottom: viewportH,
    lineY: lastEl.bottom,
    left: 0,
    right: 288,
  });

  const contentW = typeof window !== "undefined" ? window.innerWidth - 288 : 0;
  const useGrid = grid && grid.columns > 1;

  return (
    <div
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 40 }}
      aria-hidden="true"
    >
      {/* ── Column guide lines ── */}
      {useGrid && (
        <>
          {/* Column label bar */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 288,
              height: 22,
              display: "flex",
              zIndex: 43,
              background: "rgba(8,5,15,0.88)",
              borderBottom: "1px solid rgba(139,92,246,0.28)",
              pointerEvents: "none",
            }}
          >
            {Array.from({ length: grid.columns }, (_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontFamily: "var(--font-cinzel, serif)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase" as const,
                  color: "rgba(139,92,246,0.75)",
                  borderRight: i < grid.columns - 1 ? "1px dashed rgba(139,92,246,0.35)" : undefined,
                }}
              >
                Col {i + 1}
              </div>
            ))}
          </div>

          {/* Alternating column band tints */}
          {Array.from({ length: grid.columns }, (_, i) => {
            const colW = contentW / grid.columns;
            return (
              <div
                key={`band-${i}`}
                style={{
                  position: "fixed",
                  left: i * colW,
                  width: colW,
                  top: 22,
                  bottom: 0,
                  background: i % 2 === 0 ? "rgba(139,92,246,0.025)" : "transparent",
                  zIndex: 37,
                  pointerEvents: "none",
                }}
              />
            );
          })}

          {/* Column separator lines */}
          {Array.from({ length: grid.columns - 1 }, (_, i) => {
            const colW = contentW / grid.columns;
            return (
              <div
                key={`sep-${i}`}
                style={{
                  position: "fixed",
                  left: (i + 1) * colW,
                  top: 22,
                  bottom: 0,
                  width: 1,
                  borderLeft: "1px dashed rgba(139,92,246,0.38)",
                  zIndex: 38,
                  pointerEvents: "none",
                }}
              />
            );
          })}
        </>
      )}

      {/* ── Row guide lines (only when explicit rows are defined) ── */}
      {useGrid && grid.rows && grid.rows > 1 && rowBoundaries.length > 0 && (
        <>
          {/* Left row label strip background */}
          <div
            style={{
              position: "fixed",
              top: 22,
              left: 0,
              width: 22,
              bottom: 0,
              zIndex: 43,
              background: "rgba(8,5,15,0.88)",
              borderRight: "1px solid rgba(139,92,246,0.28)",
              pointerEvents: "none",
            }}
          />

          {/* Row number labels — one fixed div per row, positioned at its viewport Y */}
          {rowBoundaries.map((row, i) => (
            <div
              key={`row-label-${i}`}
              style={{
                position: "fixed",
                left: 0,
                top: row.top,
                width: 22,
                height: row.height,
                zIndex: 44,
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontFamily: "var(--font-cinzel, serif)",
                letterSpacing: "0.18em",
                color: "rgba(139,92,246,0.75)",
                borderBottom: i < rowBoundaries.length - 1 ? "1px dashed rgba(139,92,246,0.35)" : undefined,
              }}
            >
              {i + 1}
            </div>
          ))}

          {/* Horizontal row separator lines across the content area */}
          {rowBoundaries.slice(0, -1).map((row, i) => (
            <div
              key={`row-sep-${i}`}
              style={{
                position: "fixed",
                left: 22,
                right: 288,
                top: row.top + row.height,
                height: 1,
                borderTop: "1px dashed rgba(139,92,246,0.38)",
                zIndex: 38,
                pointerEvents: "none",
              }}
            />
          ))}
        </>
      )}

      {/* Block drag handles */}
      {measured.map((el) => {
        const item = itemById.get(el.rawId);
        if (!item) return null;
        return (
          <BlockHandle
            key={el.rawId}
            item={item}
            measured={el}
            pathname={pathname}
            editingId={editingId}
            onEditToggle={() => onEditToggle(item.id)}
            onDelete={() => onDeleteBlock(item.id)}
            isSelected={selectedId === item.id}
            onSelect={() => setSelectedId(item.id)}
            anyDragging={anyDragging}
            grid={grid}
            onPlacementChange={onPlacementChange}
            onResizeStart={handleResizeStart}
            isResizing={isResizing}
          />
        );
      })}

      {/* Full-coverage drop zones */}
      {zones.map((zone) => (
        <DropZone
          key={zone.id}
          id={zone.id}
          top={zone.top}
          bottom={zone.bottom}
          lineY={zone.lineY}
          left={zone.left}
          right={zone.right}
          anyDragging={anyDragging}
          onInsertAt={onInsertAt}
        />
      ))}
    </div>
  );
}
