"use client";

import { useState, useRef, useEffect } from "react";
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

/** Compute grid dimension overrides needed to fit all items. */
function computeExpandOverrides(
  items: CardLayoutItem[],
  columns: number,
  rows: number,
): Partial<Record<string, unknown>> {
  let reqCols = columns;
  let reqRows = rows;
  for (const item of items) {
    const c  = numProp(item.props.col, 1);
    const r  = numProp(item.props.row, 1);
    const cs = numProp(item.props.colSpan, 1);
    const rs = numProp(item.props.rowSpan, 1);
    reqCols = Math.max(reqCols, c + cs - 1);
    reqRows = Math.max(reqRows, r + rs - 1);
  }
  const overrides: Partial<Record<string, unknown>> = {};
  if (reqCols !== columns) overrides.columns = String(reqCols);
  if (reqRows !== rows)    overrides.rows    = String(reqRows);
  return overrides;
}

// ── Type metadata ─────────────────────────────────────────────────────────────

export const GRID_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  grid:         { label: "Grid",       icon: "⊞", color: "#8b5cf6" },
  header:       { label: "Header",     icon: "H", color: "#f59e0b" },
  text:         { label: "Text",       icon: "T", color: "#60a5fa" },
  "inner-card": { label: "Inner Card", icon: "◧", color: "#a78bfa" },
  image:        { label: "Image",      icon: "▣", color: "#34d399" },
  divider:      { label: "Divider",    icon: "—", color: "#5a5060" },
  person:       { label: "Person",     icon: "◉", color: "#f59e0b" },
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
    case "person": {
      const name = item.props.name as string | undefined;
      const role = item.props.role as string | undefined;
      const img  = item.props.img  as string | undefined;
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0" }}>
          {img ? (
            <img src={img} alt={name ?? ""} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", objectPosition: "top", border: "1.5px solid var(--color-accent-gold)", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: "1.5px solid var(--color-accent-gold)", background: "var(--color-bg-card)", color: "var(--color-accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "var(--font-cinzel, serif)", flexShrink: 0 }}>
              {(name ?? "?")[0]}
            </div>
          )}
          <p style={{ fontSize: "0.7rem", fontFamily: "var(--font-cinzel, serif)", color: "var(--color-accent-gold)", margin: 0, textAlign: "center" }}>{name ?? "(no name)"}</p>
          {role && <p style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-muted)", margin: 0, textAlign: "center" }}>{role}</p>}
        </div>
      );
    }
    default:
      return null;
  }
}

// ── Resize handle ─────────────────────────────────────────────────────────────

function ResizeHandle({
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

// ── Span number input ─────────────────────────────────────────────────────────

function SpanInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <>
      <span style={{ fontSize: 8, color: "#5a5060", lineHeight: 1 }}>{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (isFinite(v) && v >= 1) onChange(v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 30, height: 16, fontSize: 9, textAlign: "center",
          background: "rgba(255,255,255,0.07)", border: "1px solid #3a3a45",
          borderRadius: 2, color: "#a89880", padding: "0 2px",
          appearance: "textfield",
        }}
      />
    </>
  );
}

// ── Draggable item tile ───────────────────────────────────────────────────────

function GridItemTile({
  item,
  isSelected,
  dragging,
  isResizing,
  onSelect,
  onItemChange,
  onResizeStart,
}: {
  item: CardLayoutItem;
  isSelected: boolean;
  dragging: boolean;
  isResizing: boolean;
  onSelect: () => void;
  onItemChange: (updates: Partial<Record<string, string>>) => void;
  onResizeStart: (e: React.PointerEvent, dir: "col" | "row" | "both") => void;
}) {
  const [hovered, setHovered] = useState(false);
  const col     = numProp(item.props.col, 1, 1, 6);
  const row     = numProp(item.props.row, 1, 1, 10);
  const colSpan = numProp(item.props.colSpan, 1);
  const rowSpan = numProp(item.props.rowSpan, 1);
  const meta    = GRID_TYPE_META[item.type] ?? { label: item.type, icon: "?", color: "#5a5060" };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `gi::${item.id}`,
    data: { item },
  });

  const showControls = (hovered || isSelected) && !isResizing && !dragging;

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        gridColumn: `${col} / span ${colSpan}`,
        gridRow:    `${row} / span ${rowSpan}`,
        zIndex:       isDragging ? 3 : 2,
        opacity:      isDragging ? 0.3 : 1,
        pointerEvents: (dragging && !isDragging) || isResizing ? "none" : "auto",
        outline:      isSelected ? "2px solid #8b5cf6" : hovered ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
        outlineOffset: "-1px",
        borderRadius: 4,
        cursor:       "pointer",
        padding:      "8px 10px",
        position:     "relative",
        overflow:     "visible",
        userSelect:   "none",
        boxSizing:    "border-box",
        transition:   "outline-color 0.12s, opacity 0.12s",
      }}
    >
      <div style={{ overflow: "hidden", borderRadius: 3 }}>
        <ItemContent item={item} />
      </div>

      {/* Floating controls bar */}
      <div style={{
        position: "absolute",
        top: 4,
        right: 4,
        display: "flex",
        alignItems: "center",
        gap: 3,
        opacity: showControls ? 1 : 0,
        transition: "opacity 0.12s",
        pointerEvents: showControls ? "auto" : "none",
        background: "rgba(8,5,15,0.88)",
        border: "1px solid #2a2a35",
        borderRadius: 4,
        padding: "2px 5px",
        zIndex: 8,
      }}>
        <span style={{ fontSize: 9, color: meta.color, fontFamily: "var(--font-cinzel, serif)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
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

        {isSelected && (
          <>
            <div style={{ width: 1, height: 10, background: "#2a2a35", margin: "0 1px" }} />
            <SpanInput label="C" value={colSpan} onChange={(v) => onItemChange({ colSpan: String(v) })} />
            <SpanInput label="R" value={rowSpan} onChange={(v) => onItemChange({ rowSpan: String(v) })} />
          </>
        )}
      </div>

      {/* Resize handles */}
      <ResizeHandle dir="col"  show={showControls} onPointerDown={(e) => onResizeStart(e, "col")} />
      <ResizeHandle dir="row"  show={showControls} onPointerDown={(e) => onResizeStart(e, "row")} />
      <ResizeHandle dir="both" show={showControls} onPointerDown={(e) => onResizeStart(e, "both")} />
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

const ROW_HEIGHT = 88;

interface ResizeState {
  itemId: string;
  dir: "col" | "row" | "both";
  startColSpan: number;
  startRowSpan: number;
  startX: number;
  startY: number;
}

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
  const [isResizing, setIsResizing] = useState(false);

  const gridRef     = useRef<HTMLDivElement>(null);
  const resizingRef = useRef<ResizeState | null>(null);

  // Always-current snapshot for use inside stable effect handlers
  const latestRef = useRef<{
    gridItems: CardLayoutItem[];
    columns: number;
    rows: number;
    gap: string;
    props: Record<string, unknown>;
    gridRoot: CardLayoutItem;
    onPropsChange: (p: Record<string, unknown>) => void;
  }>({
    gridItems: [], columns: 2, rows: 1, gap: "md",
    props: {}, gridRoot: {} as CardLayoutItem,
    onPropsChange: () => {},
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Register global pointer handlers once — reads state via refs
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!resizingRef.current) return;
      const el = gridRef.current;
      if (!el) return;

      const { itemId, dir, startColSpan, startRowSpan, startX, startY } = resizingRef.current;
      const { gridItems, columns, rows, gap, props, gridRoot, onPropsChange } = latestRef.current;

      const rect   = el.getBoundingClientRect();
      const gapPx  = gap === "sm" ? 8 : gap === "lg" ? 20 : 12;
      const cellW  = (rect.width  - gapPx * (columns - 1)) / columns;
      const cellH  = (rect.height - gapPx * (rows    - 1)) / rows;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newColSpan = startColSpan;
      let newRowSpan = startRowSpan;

      if (dir === "col" || dir === "both") {
        newColSpan = Math.max(1, startColSpan + Math.round(dx / (cellW + gapPx)));
      }
      if (dir === "row" || dir === "both") {
        newRowSpan = Math.max(1, startRowSpan + Math.round(dy / (cellH + gapPx)));
      }

      const item = gridItems.find((i) => i.id === itemId);
      if (!item) return;

      const curCS = numProp(item.props.colSpan, 1);
      const curRS = numProp(item.props.rowSpan, 1);
      if (newColSpan === curCS && newRowSpan === curRS) return;

      const updates: Partial<Record<string, string>> = {};
      if (newColSpan !== curCS) updates.colSpan = String(newColSpan);
      if (newRowSpan !== curRS) updates.rowSpan = String(newRowSpan);

      const newItems = gridItems.map((i) =>
        i.id === itemId ? { ...i, props: { ...i.props, ...updates } } : i
      );

      const overrides = computeExpandOverrides(newItems, columns, rows);
      onPropsChange(saveCardLayoutItems(props, gridRoot, newItems, Object.keys(overrides).length ? overrides : undefined));
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

  const parsed = parseCardLayoutProps(props);
  if (!parsed) return null;

  const { gridRoot, columns, rows, gap, gridItems } = parsed;
  const gapCss = gap === "sm" ? "0.5rem" : gap === "lg" ? "1.25rem" : "0.75rem";
  const isDragging = activeItem !== null;

  // Keep latestRef in sync every render
  latestRef.current = { gridItems, columns, rows, gap, props, gridRoot, onPropsChange };

  function saveItems(newItems: CardLayoutItem[]) {
    const overrides = computeExpandOverrides(newItems, columns, rows);
    onPropsChange(saveCardLayoutItems(props, gridRoot, newItems, Object.keys(overrides).length ? overrides : undefined));
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
    const itemId = String(active.id).slice(4);
    saveItems(
      gridItems.map((item) =>
        item.id === itemId
          ? { ...item, props: { ...item.props, col: String(targetCol), row: String(targetRow) } }
          : item
      )
    );
  }

  function handleItemChange(itemId: string, updates: Partial<Record<string, string>>) {
    saveItems(
      gridItems.map((item) =>
        item.id === itemId ? { ...item, props: { ...item.props, ...updates } } : item
      )
    );
  }

  function handleResizeStart(e: React.PointerEvent, itemId: string, dir: "col" | "row" | "both") {
    const item = gridItems.find((i) => i.id === itemId);
    if (!item) return;
    resizingRef.current = {
      itemId,
      dir,
      startColSpan: numProp(item.props.colSpan, 1),
      startRowSpan: numProp(item.props.rowSpan, 1),
      startX: e.clientX,
      startY: e.clientY,
    };
    setIsResizing(true);
    onSelect(itemId);
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
        <span style={{ fontSize: 9, color: "#5a5060" }}>drag ⠿ to move · drag edges to resize</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={gridRef}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, ${ROW_HEIGHT}px)`,
            gap: gapCss,
          }}
        >
          {cells}
          {gridItems.map((item) => (
            <GridItemTile
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              dragging={isDragging}
              isResizing={isResizing}
              onSelect={() => onSelect(item.id)}
              onItemChange={(updates) => handleItemChange(item.id, updates)}
              onResizeStart={(e, dir) => handleResizeStart(e, item.id, dir)}
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
