"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveNavLayoutAction } from "./actions";
import type { NavItem, NavSection } from "@/lib/nav";

// ── Single draggable nav item row ────────────────────────────────────────────

function SortableNavItem({ item }: { item: NavItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const isExternal =
    item.href.startsWith("http://") || item.href.startsWith("https://");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] hover:border-[#3a3a45] transition-colors"
    >
      {/* Drag handle */}
      <span
        className="cursor-grab active:cursor-grabbing text-[#3a3a45] hover:text-[#5a5060] select-none text-xl leading-none transition-colors"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⠿
      </span>

      {/* Label + URL */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.label}</p>
        <p className="text-xs text-[#5a5060] font-mono truncate">{item.href}</p>
      </div>

      {/* External badge */}
      {isExternal && (
        <span className="shrink-0 text-xs text-[#5a5060] border border-[#2a2a35] rounded px-1.5 py-0.5">
          ↗ external
        </span>
      )}
    </div>
  );
}

// ── One sortable section (primary / world / tools) ───────────────────────────

function SortableSection({
  section,
  onChange,
}: {
  section: NavSection;
  onChange: (items: NavItem[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = section.items.findIndex((i) => i.id === active.id);
    const newIdx = section.items.findIndex((i) => i.id === over.id);
    onChange(arrayMove(section.items, oldIdx, newIdx));
  }

  const SECTION_DESCRIPTIONS: Record<string, string> = {
    primary: "These links appear directly in the top navigation bar.",
    world: 'These links appear inside the "Myrdae" dropdown menu.',
    tools: "These links appear at the far right of the navigation bar.",
  };

  return (
    <section>
      <div className="mb-3">
        <h2 className="font-cinzel text-base tracking-widest uppercase text-[#f59e0b]">
          {section.label}
        </h2>
        {SECTION_DESCRIPTIONS[section.id] && (
          <p className="text-xs text-[#5a5060] mt-0.5">
            {SECTION_DESCRIPTIONS[section.id]}
          </p>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={section.items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {section.items.map((item) => (
              <SortableNavItem key={item.id} item={item} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

// ── Top-level editor ──────────────────────────────────────────────────────────

export function PageLayoutEditor({ initial }: { initial: NavSection[] }) {
  const [sections, setSections] = useState<NavSection[]>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSectionChange(sectionId: string, items: NavItem[]) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, items } : s))
    );
  }

  function handleSave() {
    startTransition(async () => {
      await saveNavLayoutAction(sections);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <SortableSection
          key={section.id}
          section={section}
          onChange={(items) => handleSectionChange(section.id, items)}
        />
      ))}

      {/* Save bar */}
      <div className="flex items-center gap-4 pt-6 border-t border-[#2a2a35]">
        <button
          onClick={handleSave}
          disabled={pending}
          className="px-6 py-2.5 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Layout"}
        </button>
        {saved && (
          <p className="text-sm text-green-400">
            Saved! The public navbar will reflect your changes.
          </p>
        )}
      </div>
    </div>
  );
}
