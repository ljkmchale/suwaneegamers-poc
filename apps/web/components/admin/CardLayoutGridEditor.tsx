"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  pointerWithin,
  type DragEndEvent,
  type Active,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CardLayoutItem } from "@/lib/pageBlocks";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseGridItems(raw: unknown): CardLayoutItem[] {
  if (Array.isArray(raw)) return raw as CardLayoutItem[];
  if (typeof raw !== "string") return [];
  try {
    const p = JSON.parse(raw || "[]");
    return Array.isArray(p) ? (p as CardLayoutItem[]) : [];
  } catch {
    return [];
  }
}

export function numProp(val: unknown, fallback: number, min = 1, max = 12): number {
  const n = parseInt(String(val ?? ""), 10);
  if (!isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Parse layout-card block props into the editable grid structure. */
export function parseCardLayoutProps(props: Record<string, unknown>) {
  const top = parseGridItems(props.items);
  const gridRoot = top[0];
  if (!gridRoot || gridRoot.type !== "grid") return null;
  return {
    gridRoot,
    columns: numProp(gridRoot.props.columns, 2, 1, 6),
    rows:    numProp(gridRoot.props.rows, 1, 1, 10),
    gap:     (gridRoot.props.gap as string) ?? "md",
    gridItems: parseGridItems(gridRoot.props.items),
  };
}

/** Serialize updated grid items back into layout-card block props. */
export function saveCardLayoutItems(
  blockProps: Record<string, unknown>,
  gridRoot: CardLayoutItem,
  newItems: CardLayoutItem[],
  gridOverrides?: Partial<Record<string, unknown>>,
): Record<string, unknown> {
  const newGridRoot: CardLayoutItem = {
    ...gridRoot,
    props: { ...gridRoot.props, ...gridOverrides, items: JSON.stringify(newItems) },
  };
  return { ...blockProps, items: JSON.stringify([newGridRoot]) };
}

/** Find the first grid cell not occupied by any existing item. */
export function findFreeCell(
  items: CardLayoutItem[],
  columns: number,
  rows: number,
): { col: number; row: number; needsNewRow: boolean } {
  const occupied = new Set<string>();
  for (const item of items) {
    const c  = numProp(item.props.col, 1, 1, 6);
    const r  = numProp(item.props.row, 1, 1, 10);
    const cs = numProp(item.props.colSpan, 1, 1, 6);
    const rs = numProp(item.props.rowSpan, 1, 1, 10);
    for (let dc = 0; dc < cs; dc++) {
      for (let dr = 0; dr < rs; dr++) {
        occupied.add(`${c + dc}-${r + dr}`);
      }
    }
  }
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= columns; c++) {
      if (!occupied.has(`${c}-${r}`)) return { col: c, row: r, needsNewRow: false };
    }
  }
  return { col: 1, row: rows + 1, needsNewRow: true };
}

// ── Type metadata ─────────────────────────────────────────────────────────────

export const GRID_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  grid:         { label: "Grid",       icon: "⊞", color: "#8b5cf6" },
  header:       { label: "Header",     icon: "H", color: "#f59e0b" },
  text:         { label: "Text",       icon: "T", color: "#60a5fa" },
  "inner-card": { label: "Inner Card", icon: "◧", color: "#a78bfa" },
  image:        { label: "Image",      icon: "▣", color: "#34d399" },
  divider:      { label: "Divider",    icon: "—", color: "#5a5060" },
};

// ── Droppable grid cell ───────────────────────────────────────────────────────

function GridCell({
  col,
  row,
  dragging,
}: {
  col: number;
  row: number;
  dragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `gc::${col}-${row}` });
  return (
    <div
      ref={setNodeRef}
      style={{
        gridColumn: col,
        gridRow: row,
        border: `1px dashed ${isOver ? "#8b5cf6" : "rgba(255,255,255,0.28)"}`,
        background: isOver
          ? "rgba(139,92,246,0.15)"
          : dragging
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.04)",
        borderRadius: 4,
        transition: "background 0.1s, border-color 0.1s",
        // During drag, cells rise to the top so pointer events can reach them.
        zIndex: dragging ? 5 : 1,
        pointerEvents: dragging ? "auto" : "none",
      }}
    />
  );
}

// ── Real content renderer (matches live page styling) ────────────────────────

function ItemContent({ item }: { item: CardLayoutItem }) {
  switch (item.type) {
    case "header":
      return (
        <div style={{ padding: "4px 0" }}>
          {item.props.eyebrow ? (
            <p style={{ fontSize: "0.6rem", fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 4, color: "var(--color-accent-arcane)" }}>
              {item.props.eyebrow as string}
            </p>
          ) : null}
          <h2 style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: item.props.size === "lg" ? "1.25rem" : "1rem", lineHeight: 1.2, color: "var(--color-text-primary)", margin: 0 }}>
            {(item.props.title as string | undefined) ?? "(no title)"}
          </h2>
        </div>
      );
    case "text":
      return (
        <p style={{ fontSize: "0.8rem", lineHeight: 1.6, color: "var(--color-text-secondary)", whiteSpace: "pre-wrap", margin: 0 }}>
          {(item.props.content as string | undefined) ?? ""}
        </p>
      );
    case "image": {
      const src = item.props.src as string | undefined;
      return src ? (
        <img src={src} alt={(item.props.alt as string) ?? ""} style={{ width: "100%", height: "100%", objectFit: item.props.fit === "contain" ? "contain" : "cover", borderRadius: 3 }} />
      ) : (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.03)", borderRadius: 3, fontSize: 11, color: "#5a5060" }}>
          No image
        </div>
      );
    }
    case "inner-card": {
      const children = parseGridItems(item.props.items);
      return (
        <div style={{ border: "1px solid var(--color-bg-border)", borderRadius: 6, padding: "8px 10px", background: "rgba(15,10,26,.58)", height: "100%", boxSizing: "border-box" }}>
          {children.slice(0, 3).map((child) => (
            <div key={child.id} style={{ marginBottom: 4 }}>
              <ItemContent item={child} />
            </div>
          ))}
          {children.length === 0 && <p style={{ fontSize: 11, color: "#5a5060" }}>Empty inner card</p>}
        </div>
      );
    }
    case "divider":
      return <div style={{ height: 1, background: "var(--color-bg-border)", margin: "4px 0", alignSelf: "center", width: "100%" }} />;
    default:
      return null;
  }
}

// ── Draggable item tile (renders real content + edit controls) ────────────────

function GridItemTile({
  item,
  isSelected,
  dragging,
  onSelect,
}: {
  item: CardLayoutItem;
  isSelected: boolean;
  dragging: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const col     = numProp(item.props.col, 1, 1, 6);
  const row     = numProp(item.props.row, 1, 1, 10);
  const colSpan = numProp(item.props.colSpan, 1, 1, 6);
  const rowSpan = numProp(item.props.rowSpan, 1, 1, 10);
  const meta    = GRID_TYPE_META[item.type] ?? { label: item.type, icon: "?", color: "#5a5060" };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `gi::${item.id}`,
    data: { item },
  });

  const showControls = hovered || isSelected;

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        gridColumn: `${col} / span ${colSpan}`,
        gridRow:    `${row} / span ${rowSpan}`,
        transform:  CSS.Translate.toString(transform),
        zIndex:       isDragging ? 3 : 2,
        opacity:      isDragging ? 0.25 : 1,
        pointerEvents: dragging && !isDragging ? "none" : "auto",
        outline:      isSelected ? "2px solid #8b5cf6" : hovered ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
        outlineOffset: "-1px",
        borderRadius: 4,
        cursor:       "pointer",
        padding:      "8px 10px",
        position:     "relative",
        overflow:     "hidden",
        userSelect:   "none",
        boxSizing:    "border-box",
        transition:   "outline-color 0.12s",
      }}
    >
      {/* Actual page content */}
      <ItemContent item={item} />

      {/* Floating controls bar — appears on hover/select */}
      <div style={{
        position: "absolute",
        top: 4,
        right: 4,
        display: "flex",
        alignItems: "center",
        gap: 2,
        opacity: showControls ? 1 : 0,
        transition: "opacity 0.12s",
        pointerEvents: showControls ? "auto" : "none",
        background: "rgba(8,5,15,0.88)",
        border: "1px solid #2a2a35",
        borderRadius: 4,
        padding: "2px 4px",
      }}>
        <span style={{ fontSize: 9, color: meta.color, fontFamily: "var(--font-cinzel, serif)", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 3 }}>
          {meta.icon}
        </span>
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "grab", color: "#a89880", fontSize: 12, lineHeight: 1 }}
          title="Drag to reposition"
        >
          ⠿
        </span>
      </div>
    </div>
  );
}

// ── Drag overlay ──────────────────────────────────────────────────────────────

function DragPreview({ item }: { item: CardLayoutItem }) {
  const meta = GRID_TYPE_META[item.type] ?? { label: item.type, icon: "?", color: "#5a5060" };
  return (
    <div style={{
      background: "#0f0a1a",
      border: `2px solid ${meta.color}`,
      borderRadius: 5,
      padding: "6px 14px",
      opacity: 0.92,
      boxShadow: `0 8px 24px rgba(0,0,0,0.7), 0 0 16px ${meta.color}44`,
      minWidth: 100,
      cursor: "grabbing",
    }}>
      <span style={{ fontSize: 10, color: meta.color, fontFamily: "var(--font-cinzel, serif)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {meta.icon} {meta.label}
      </span>
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

const ROW_HEIGHT = 88; // px per grid row

export function CardLayoutGridEditor({
  props,
  onPropsChange,
  selectedId,
  onSelect,
}: {
  props: Record<string, unknown>;
  onPropsChange: (props: Record<string, unknown>) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [activeItem, setActiveItem] = useState<CardLayoutItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const parsed = parseCardLayoutProps(props);
  if (!parsed) return null;

  const { gridRoot, columns, rows, gap, gridItems } = parsed;
  const gapCss = gap === "sm" ? "0.5rem" : gap === "lg" ? "1.25rem" : "0.75rem";
  const isDragging = activeItem !== null;

  function saveItems(newItems: CardLayoutItem[]) {
    onPropsChange(saveCardLayoutItems(props, gridRoot, newItems));
  }

  function handleDragStart(e: { active: Active }) {
    const d = e.active.data.current as { item: CardLayoutItem } | undefined;
    setActiveItem(d?.item ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("gc::")) return;
    const [colStr, rowStr] = overId.slice(4).split("-");
    const targetCol = parseInt(colStr, 10);
    const targetRow = parseInt(rowStr, 10);
    const itemId = String(active.id).slice(4); // strip "gi::"
    saveItems(
      gridItems.map((item) =>
        item.id === itemId
          ? { ...item, props: { ...item.props, col: String(targetCol), row: String(targetRow) } }
          : item
      )
    );
  }

  // Build N×M background cells
  const cells: React.ReactNode[] = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= columns; c++) {
      cells.push(<GridCell key={`${c}-${r}`} col={c} row={r} dragging={isDragging} />);
    }
  }

  return (
    <article className="fantasy-card p-5 md:p-6" onClick={() => onSelect(null)}>
      {/* Grid legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontFamily: "var(--font-cinzel, serif)", color: "#5a5060", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {columns} col × {rows} row
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
        <span style={{ fontSize: 9, color: "#5a5060" }}>drag ⠿ to reposition</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, ${ROW_HEIGHT}px)`,
            gap: gapCss,
          }}
        >
          {/* Cells first in DOM = visually behind items */}
          {cells}
          {/* Items after cells = visually in front */}
          {gridItems.map((item) => (
            <GridItemTile
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              dragging={isDragging}
              onSelect={() => onSelect(item.id)}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? <DragPreview item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>
    </article>
  );
}
