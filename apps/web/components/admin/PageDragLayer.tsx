"use client";

import { useEffect, useState, useCallback } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PAGE_SECTIONS } from "@/lib/pageSections";
import { getAssetDef } from "@/lib/pageBlocks";
import type { PageItem } from "@/lib/pageBlocks";

// ── Measured position of a DOM element ───────────────────────────────────────

interface MeasuredEl {
  rawId: string;           // value of data-block-id or data-section-id
  kind: "section" | "block";
  top: number;             // viewport-relative (fixed positioning)
  bottom: number;
  left: number;
  width: number;
}

// ── Drop zone strip (between elements) ───────────────────────────────────────

function DropZone({
  id,
  top,
  anyDragging,
}: {
  id: string;
  top: number;
  anyDragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "fixed",
        left: 0,
        right: 288, // leave room for the panel
        top: top - (anyDragging ? 18 : 3),
        height: anyDragging ? 36 : 6,
        pointerEvents: "auto",
        zIndex: 42,
        transition: "height 0.12s, top 0.12s",
      }}
      className="flex items-center justify-center"
    >
      {/* The visible rule */}
      <div
        className={`absolute inset-x-0 transition-all duration-150 ${
          isOver
            ? "h-0.5 opacity-100"
            : anyDragging
            ? "h-px opacity-20"
            : "h-px opacity-0"
        }`}
        style={{ background: isOver ? "#8b5cf6" : "rgba(255,255,255,0.3)" }}
      />

      {/* "Drop here" pill */}
      {isOver && (
        <div
          className="relative z-10 px-3 py-1 rounded-full font-cinzel text-[10px] tracking-widest uppercase text-white pointer-events-none"
          style={{ background: "#8b5cf6", boxShadow: "0 0 20px rgba(139,92,246,0.6)" }}
        >
          Drop here
        </div>
      )}
    </div>
  );
}

// ── Drag handle bar (overlaid at the top of each element) ─────────────────────

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

  const HANDLE_H = 32;
  const accentColor = isSection ? "#8b5cf6" : "#f59e0b";

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "fixed",
        top: measured.top,
        left: measured.left,
        width: measured.width,
        height: HANDLE_H,
        transform: CSS.Translate.toString(transform),
        zIndex: 41,
        pointerEvents: "auto",
        opacity: isDragging ? 0.15 : 1,
        transition: isDragging ? undefined : "opacity 0.15s",
      }}
      className="group"
    >
      {/* Always-visible top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-60 transition-opacity"
        style={{ background: accentColor }}
      />

      {/* Handle bar — appears on hover */}
      <div
        className="absolute inset-0 flex items-center gap-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{
          background: `linear-gradient(to bottom, rgba(8,5,15,0.88) 0%, rgba(8,5,15,0.5) 70%, transparent 100%)`,
        }}
      >
        {/* Drag grip */}
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing select-none text-base leading-none transition-colors"
          style={{ color: "rgba(255,255,255,0.5)" }}
          title="Drag to reorder"
        >
          ⠿
        </span>

        {/* Icon + label */}
        <span className="text-sm leading-none" style={{ color: accentColor }}>
          {icon}
        </span>
        <span className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.75)" }}>
          {label}
        </span>

        {/* Block actions */}
        {!isSection && (
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onEditToggle(); }}
              className="w-6 h-6 flex items-center justify-center rounded transition-colors text-sm leading-none"
              style={{ color: isEditing ? "#8b5cf6" : "rgba(255,255,255,0.4)" }}
              title="Edit properties"
            >
              ✎
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-6 h-6 flex items-center justify-center rounded text-base leading-none transition-colors hover:text-red-400"
              style={{ color: "rgba(255,255,255,0.4)" }}
              title="Remove block"
            >
              ×
            </button>
          </div>
        )}
      </div>
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
}: {
  items: PageItem[];
  pathname: string;
  anyDragging: boolean;
  editingId: string | null;
  onEditToggle: (id: string) => void;
  onDeleteBlock: (id: string) => void;
}) {
  const [measured, setMeasured] = useState<MeasuredEl[]>([]);

  const remeasure = useCallback(() => {
    const result: MeasuredEl[] = [];
    document
      .querySelectorAll<HTMLElement>("[data-block-id], [data-section-id]")
      .forEach((el) => {
        const blockId = el.getAttribute("data-block-id");
        const sectionId = el.getAttribute("data-section-id");
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return; // skip invisible
        result.push({
          rawId: blockId ?? sectionId!,
          kind: blockId ? "block" : "section",
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
        });
      });
    setMeasured(result);
  }, []);

  // Initial measure + track scroll / resize
  useEffect(() => {
    remeasure();
    window.addEventListener("scroll", remeasure, { passive: true });
    window.addEventListener("resize", remeasure);
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.documentElement);
    return () => {
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

  return (
    <div
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 40 }}
      aria-hidden="true"
    >
      {/* Drop zone above the first element */}
      <DropZone
        id="dz::0"
        top={measured[0].top}
        anyDragging={anyDragging}
      />

      {measured.map((el, i) => {
        const item = itemById.get(el.rawId);
        if (!item) return null;

        return (
          <div key={el.rawId}>
            <BlockHandle
              item={item}
              measured={el}
              pathname={pathname}
              editingId={editingId}
              onEditToggle={() => onEditToggle(item.id)}
              onDelete={() => onDeleteBlock(item.id)}
            />
            {/* Drop zone below this element */}
            <DropZone
              id={`dz::${i + 1}`}
              top={el.bottom}
              anyDragging={anyDragging}
            />
          </div>
        );
      })}
    </div>
  );
}
