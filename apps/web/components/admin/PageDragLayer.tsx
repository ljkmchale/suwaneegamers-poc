"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PAGE_SECTIONS } from "@/lib/pageSections";
import { getAssetDef } from "@/lib/pageBlocks";
import type { PageItem, PageGridMeta } from "@/lib/pageBlocks";

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
}: {
  item: PageItem;
  measured: MeasuredEl;
  pathname: string;
  onDelete: () => void;
  editingId: string | null;
  onEditToggle: () => void;
}) {
  const [isHovering, setIsHovering] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const isActive = isEditing || isHovering || isDragging;
  const borderColor = isEditing ? "#8b5cf6" : "#f59e0b";
  const TOOLBAR_H = 34;
  // Show toolbar above the block when there's room; otherwise inside at the top
  const toolbarAbove = measured.top > TOOLBAR_H + 8;

  function enter() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovering(true);
  }

  function leave() {
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(false);
      hoverTimerRef.current = null;
    }, 120);
  }

  return (
    <div
      ref={setNodeRef}
      {...(isSection ? {} : attributes)}
      {...(isSection ? {} : listeners)}
      onMouseEnter={enter}
      onMouseLeave={leave}
      style={{
        position: "fixed",
        top: measured.top,
        left: measured.left,
        width: measured.width,
        height: Math.max(measured.height, 32),
        transform: CSS.Translate.toString(transform),
        zIndex: 41,
        pointerEvents: isEditing ? "none" : "auto",
        opacity: isDragging ? 0.15 : 1,
        // Selection outline — amber on hover, arcane when editing
        outline: isActive && !isSection ? `2px solid ${borderColor}` : "2px solid transparent",
        outlineOffset: "-1px",
        borderRadius: "4px",
        cursor: isSection ? "default" : isDragging ? "grabbing" : "grab",
        transition: "outline-color 0.12s",
        background: isEditing ? "rgba(139,92,246,0.04)" : "transparent",
      }}
    >
      {/* ── Floating toolbar for blocks ── */}
      {!isSection && (
        <div
          onMouseEnter={enter}
          onMouseLeave={leave}
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
        </div>
      )}

      {/* ── Section hover label ── */}
      {isSection && (isHovering || isDragging) && (
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
  grid,
}: {
  items: PageItem[];
  pathname: string;
  anyDragging: boolean;
  editingId: string | null;
  onEditToggle: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onInsertAt?: (index: number) => void;
  grid?: PageGridMeta | null;
}) {
  const [measured, setMeasured] = useState<MeasuredEl[]>([]);

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
        const child = el.firstElementChild;
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
  }, []);

  // Initial measure + track scroll / resize
  useEffect(() => {
    const initialMeasure = window.setTimeout(remeasure, 0);
    window.addEventListener("scroll", remeasure, { passive: true });
    window.addEventListener("resize", remeasure);
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.documentElement);
    return () => {
      window.clearTimeout(initialMeasure);
      window.removeEventListener("scroll", remeasure);
      window.removeEventListener("resize", remeasure);
      ro.disconnect();
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
  const midOf = (el: MeasuredEl) => (el.top + el.bottom) / 2;

  const measuredItems = measured
    .map((el) => ({ el, itemIndex: items.findIndex((item) => item.id === el.rawId) }))
    .filter(({ itemIndex }) => itemIndex >= 0);

  const zones = measuredItems.map(({ el }, i) => {
    const previous = measuredItems[i - 1]?.el;
    const isGridCard = el.kind === "block" && el.width < window.innerWidth - 360;
    const bandTop = i === 0 || !previous ? 0 : midOf(previous);
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
