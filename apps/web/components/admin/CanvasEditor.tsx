"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getAssetDef } from "@/lib/pageBlocks";
import type { PageItem, BlockItem } from "@/lib/pageBlocks";

// ── Snap helpers ──────────────────────────────────────────────────────────────

const SNAP = 8;

function snapPx(v: number) {
  return Math.round(v / SNAP) * SNAP;
}

function snapPct(v: number, containerW: number) {
  if (containerW === 0) return v;
  const px = (v / 100) * containerW;
  return (snapPx(px) / containerW) * 100;
}

// ── Resize handle types ───────────────────────────────────────────────────────

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const ALL_HANDLES: Handle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const CURSOR: Record<Handle, string> = {
  n: "ns-resize", s: "ns-resize",
  e: "ew-resize", w: "ew-resize",
  ne: "nesw-resize", sw: "nesw-resize",
  nw: "nwse-resize", se: "nwse-resize",
};

function handleStyle(h: Handle): React.CSSProperties {
  const S = 10;
  const base: React.CSSProperties = {
    position: "absolute",
    width: S,
    height: S,
    background: "#8b5cf6",
    border: "1.5px solid #c4b5fd",
    borderRadius: 2,
    cursor: CURSOR[h],
    zIndex: 10,
    boxShadow: "0 0 5px rgba(139,92,246,0.9)",
  };
  switch (h) {
    case "n":  return { ...base, top: -S/2, left: "50%", transform: "translateX(-50%)", width: 28, height: S };
    case "s":  return { ...base, bottom: -S/2, left: "50%", transform: "translateX(-50%)", width: 28, height: S };
    case "e":  return { ...base, right: -S/2, top: "50%", transform: "translateY(-50%)", width: S, height: 28 };
    case "w":  return { ...base, left: -S/2, top: "50%", transform: "translateY(-50%)", width: S, height: 28 };
    case "ne": return { ...base, top: -S/2, right: -S/2 };
    case "nw": return { ...base, top: -S/2, left: -S/2 };
    case "se": return { ...base, bottom: -S/2, right: -S/2 };
    case "sw": return { ...base, bottom: -S/2, left: -S/2 };
  }
}

// ── Interaction state ─────────────────────────────────────────────────────────

interface MoveState {
  kind: "move";
  blockId: string;
  startX: number; startY: number;
  origX: number;  origY: number;
  origW: number;  origH: number;
}

interface ResizeState {
  kind: "resize";
  blockId: string;
  handle: Handle;
  startX: number; startY: number;
  origX: number;  origY: number;
  origW: number;  origH: number;
}

type Interact = MoveState | ResizeState;

// ── Canvas rect ───────────────────────────────────────────────────────────────

interface CanvasRect { left: number; top: number; width: number; }

// ── Component ─────────────────────────────────────────────────────────────────

export function CanvasEditor({
  items,
  editingId,
  onBlockChange,
  onDelete,
  onEditToggle,
}: {
  items: PageItem[];
  editingId: string | null;
  onBlockChange: (id: string, changes: Partial<Pick<BlockItem, "x" | "y" | "w" | "h">>) => void;
  onDelete: (id: string) => void;
  onEditToggle: (id: string) => void;
}) {
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [hoveredId,    setHoveredId]    = useState<string | null>(null);
  const [canvasRect,   setCanvasRect]   = useState<CanvasRect | null>(null);
  const [scrollY,      setScrollY]      = useState(0);
  // Local drag preview — keeps overlay handles in sync without committing to parent
  const [draggingPos,  setDraggingPos]  = useState<{
    blockId: string; x: number; y: number; w: number; h: number;
  } | null>(null);

  const blocks = items.filter((i): i is BlockItem => i.kind === "block");

  // Stable refs for event handlers
  const interactRef = useRef<Interact | null>(null);
  const latestRef   = useRef<{
    blocks: BlockItem[];
    canvasRect: CanvasRect | null;
    onBlockChange: typeof onBlockChange;
    setDraggingPos: typeof setDraggingPos;
  }>({ blocks: [], canvasRect: null, onBlockChange: () => {}, setDraggingPos: () => {} });
  latestRef.current = { blocks, canvasRect, onBlockChange, setDraggingPos };

  // ── Measure canvas container ──────────────────────────────────────────────
  // canvasRect.top is stored as PAGE-RELATIVE (getBoundingClientRect().top + scrollY)
  // so it's constant regardless of scroll position.
  // scrollY is kept separately and updates on every scroll tick for the overlay math:
  //   screenTop (fixed) = canvasRect.top - scrollY + blockY

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>("[data-canvas-area='true']");
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Store page-relative top so it stays constant across scrolls
    setCanvasRect({ left: r.left, top: r.top + window.scrollY, width: r.width });
  }, []);

  // Measure on layout changes (resize, block add/remove)
  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Separate high-frequency scroll handler — only updates scrollY for overlay math
  useEffect(() => {
    setScrollY(window.scrollY);
    function onScroll() { setScrollY(window.scrollY); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Global pointer events (stable — uses refs) ────────────────────────────

  useEffect(() => {
    function computeNewPos(ia: Interact, e: PointerEvent, canvasRect: CanvasRect) {
      const dx    = e.clientX - ia.startX;
      const dy    = e.clientY - ia.startY;
      const dxPct = (dx / canvasRect.width) * 100;

      if (ia.kind === "move") {
        return {
          x:  Math.max(0, Math.min(85, snapPct(ia.origX + dxPct, canvasRect.width))),
          y:  Math.max(0, snapPx(ia.origY + dy)),
          w:  ia.origW,
          h:  ia.origH,
        };
      } else {
        const h = ia.handle;
        let x = ia.origX, y = ia.origY, w = ia.origW, ht = ia.origH;
        if (h.includes("e")) w  = Math.max(5, snapPct(ia.origW + dxPct, canvasRect.width));
        if (h.includes("w")) { x = snapPct(ia.origX + dxPct, canvasRect.width); w = Math.max(5, snapPct(ia.origW - dxPct, canvasRect.width)); }
        if (h.includes("s")) ht = Math.max(SNAP * 4, snapPx(ia.origH + dy));
        if (h.includes("n")) { y = Math.max(0, snapPx(ia.origY + dy)); ht = Math.max(SNAP * 4, snapPx(ia.origH - dy)); }
        x  = Math.max(0, x);
        w  = Math.min(100 - x, Math.max(5, w));
        return { x, y, w, h: ht };
      }
    }

    function onMove(e: PointerEvent) {
      const ia = interactRef.current;
      if (!ia) return;
      const { canvasRect, setDraggingPos } = latestRef.current;
      if (!canvasRect || canvasRect.width === 0) return;

      const { x, y, w, h } = computeNewPos(ia, e, canvasRect);

      // 1. Move the actual DOM block element immediately (no React re-render needed)
      const blockEl = document.querySelector<HTMLElement>(
        `[data-canvas-area='true'] [data-block-id="${ia.blockId}"]`
      );
      if (blockEl) {
        blockEl.style.left   = `${x}%`;
        blockEl.style.top    = `${y}px`;
        blockEl.style.width  = `${w}%`;
        blockEl.style.height = `${h}px`;
      }

      // 2. Update local preview state so the overlay handles stay aligned
      setDraggingPos({ blockId: ia.blockId, x, y, w, h });
    }

    function onUp(e: PointerEvent) {
      const ia = interactRef.current;
      if (!ia) return;
      const { canvasRect, onBlockChange, setDraggingPos } = latestRef.current;

      // Commit final position to React state
      if (canvasRect && canvasRect.width > 0) {
        const { x, y, w, h } = computeNewPos(ia, e, canvasRect);
        onBlockChange(ia.blockId, { x, y, w, h });
      }

      setDraggingPos(null);
      interactRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
    };
  }, []);

  // Clear selection on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-canvas-overlay]")) {
        setSelectedId(null);
      }
    }
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, []);

  // ── Interaction starters ──────────────────────────────────────────────────

  function startMove(e: React.PointerEvent, block: BlockItem) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-canvas-toolbar], [data-resize-handle]")) return;
    e.preventDefault();
    setSelectedId(block.id);
    interactRef.current = {
      kind: "move",
      blockId: block.id,
      startX: e.clientX,  startY: e.clientY,
      origX:  block.x ?? 5,  origY:  block.y ?? 0,
      origW:  block.w ?? 50, origH:  block.h ?? 200,
    };
  }

  function startResize(e: React.PointerEvent, block: BlockItem, handle: Handle) {
    e.stopPropagation();
    e.preventDefault();
    interactRef.current = {
      kind: "resize",
      blockId: block.id,
      handle,
      startX: e.clientX,  startY: e.clientY,
      origX:  block.x ?? 5,  origY:  block.y ?? 0,
      origW:  block.w ?? 50, origH:  block.h ?? 200,
    };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!canvasRect) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 40 }}
      aria-hidden
    >
      {blocks.map((block) => {
        // Use live dragging position if this block is being interacted with
        const live = draggingPos?.blockId === block.id ? draggingPos : null;
        const bx = live?.x ?? block.x ?? 5;
        const by = live?.y ?? block.y ?? 0;
        const bw = live?.w ?? block.w ?? 50;
        const bh = live?.h ?? block.h ?? 200;

        const screenLeft = canvasRect.left + (bx / 100) * canvasRect.width;
        const screenTop  = canvasRect.top  - scrollY + by;
        const screenW    = (bw / 100) * canvasRect.width;

        const isSelected = selectedId === block.id;
        const isHovered  = hoveredId  === block.id && !isSelected;
        const isEditing  = editingId  === block.id;
        const assetDef   = getAssetDef(block.type as Parameters<typeof getAssetDef>[0]);
        const TOOLBAR_H  = 36;
        const showAbove  = screenTop > TOOLBAR_H + 12;

        return (
          <div
            key={block.id}
            data-canvas-overlay
            style={{
              position:      "fixed",
              left:          screenLeft,
              top:           screenTop,
              width:         screenW,
              height:        bh,
              pointerEvents: "auto",
              cursor:        "move",
              outline:       isEditing  ? "2px solid #8b5cf6"
                           : isSelected ? "2px solid #8b5cf6"
                           : isHovered  ? "1px solid rgba(245,158,11,0.7)"
                           : "1px solid transparent",
              outlineOffset: "-1px",
              borderRadius:  4,
              background:    isEditing ? "rgba(139,92,246,0.04)" : "transparent",
              zIndex:        isSelected ? 45 : 43,
              userSelect:    "none",
            }}
            onMouseEnter={() => setHoveredId(block.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={(e) => { e.stopPropagation(); setSelectedId(block.id); }}
            onPointerDown={(e) => startMove(e, block)}
          >
            {/* Floating toolbar */}
            {(isSelected || isHovered) && (
              <div
                data-canvas-toolbar
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  position:      "absolute",
                  [showAbove ? "bottom" : "top"]: showAbove ? "calc(100% + 6px)" : 4,
                  left:          0,
                  display:       "flex",
                  alignItems:    "center",
                  gap:           2,
                  padding:       "3px 6px",
                  borderRadius:  6,
                  border:        "1px solid #2a2a35",
                  background:    "#08050f",
                  boxShadow:     "0 4px 16px rgba(0,0,0,0.55)",
                  whiteSpace:    "nowrap",
                  pointerEvents: "auto",
                  cursor:        "default",
                  zIndex:        2,
                }}
              >
                {/* Drag indicator */}
                <span style={{ fontSize: 13, color: "#5a5060", lineHeight: 1, marginRight: 1 }} title="Drag to move">⠿</span>

                <span style={{ fontSize: 11, color: "#f59e0b", lineHeight: 1 }}>{assetDef?.icon ?? "□"}</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: "#e8dfc8", margin: "0 2px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {assetDef?.label ?? block.type}
                </span>

                <div style={{ width: 1, height: 14, background: "#2a2a35", margin: "0 3px" }} />

                {/* Edit */}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onEditToggle(block.id); }}
                  title="Edit block"
                  style={{
                    width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, background: "none", border: "none", cursor: "pointer",
                    color: isEditing ? "#8b5cf6" : "rgba(255,255,255,0.45)",
                    borderRadius: 4,
                  }}
                >✎</button>

                {/* Delete */}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDelete(block.id); setSelectedId(null); }}
                  title="Delete block"
                  style={{
                    width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.35)", borderRadius: 4,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
                >×</button>

                <div style={{ width: 1, height: 14, background: "#2a2a35", margin: "0 3px" }} />

                {/* Position / size readout */}
                <span style={{ fontSize: 8, color: "#5a5060", fontFamily: "monospace", lineHeight: 1 }}>
                  {Math.round(bx)}%,{Math.round(by)}px · {Math.round(bw)}%×{bh}px
                </span>
              </div>
            )}

            {/* Resize handles — only when selected */}
            {isSelected && ALL_HANDLES.map((h) => (
              <div
                key={h}
                data-resize-handle
                style={handleStyle(h)}
                onPointerDown={(e) => startResize(e, block, h)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Helper: default position for a new canvas block ───────────────────────────

export function nextCanvasPosition(items: PageItem[]): { x: number; y: number; w: number; h: number } {
  const blocks = items.filter((i): i is BlockItem => i.kind === "block");
  if (blocks.length === 0) return { x: 5, y: 60, w: 90, h: 200 };
  const lowestBottom = Math.max(...blocks.map((b) => (b.y ?? 0) + (b.h ?? 200)));
  return { x: 5, y: lowestBottom + 24, w: 90, h: 200 };
}
