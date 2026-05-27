"use client";

import { useState, useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
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
import { savePageSectionOrderAction } from "@/app/admin/page-layout/actions";
import { PAGE_SECTIONS, type SectionMeta } from "@/lib/pageSections";

// ── Draggable section row ─────────────────────────────────────────────────────

function SortableRow({ section }: { section: SectionMeta }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 20 : undefined,
      }}
      className="flex items-start gap-3 rounded-lg border border-[#2a2a35] bg-[#16161e] px-4 py-3 hover:border-[#3a3a45] transition-colors"
    >
      <span
        className="cursor-grab active:cursor-grabbing text-[#3a3a45] hover:text-[#5a5060] select-none text-xl leading-tight mt-0.5 transition-colors"
        {...attributes}
        {...listeners}
      >
        ⠿
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
          {section.label}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {section.description}
        </p>
      </div>
    </div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export function PageEditOverlay() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<SectionMeta[]>([]);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const availableSections = PAGE_SECTIONS[pathname] ?? [];
  const hasLayout = availableSections.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch current stored order when panel opens or pathname changes
  useEffect(() => {
    if (!hasLayout) return;
    fetch(`/api/page-layout?page=${encodeURIComponent(pathname)}`)
      .then((r) => r.json())
      .then(({ order }: { order: string[] }) => {
        const meta = order
          .map((id) => availableSections.find((s) => s.id === id))
          .filter(Boolean) as SectionMeta[];
        // Append any sections not yet in stored order (new additions)
        const extras = availableSections.filter((s) => !order.includes(s.id));
        setSections([...meta, ...extras]);
      })
      .catch(() => setSections(availableSections));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, open]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex((s) => s.id === active.id);
    const newIdx = sections.findIndex((s) => s.id === over.id);
    setSections(arrayMove(sections, oldIdx, newIdx));
  }

  function handleSave() {
    startTransition(async () => {
      await savePageSectionOrderAction(pathname, sections.map((s) => s.id));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  // Don't render on admin pages
  if (pathname.startsWith("/admin")) return null;
  if (!hasLayout) return null;

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Edit page layout"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-cinzel tracking-widest uppercase shadow-2xl backdrop-blur-md transition-all hover:scale-105"
        style={{
          background: open ? "var(--color-accent-arcane)" : "rgba(15, 10, 26, 0.92)",
          borderColor: open ? "var(--color-accent-arcane)" : "var(--color-bg-border)",
          color: open ? "#fff" : "var(--color-text-secondary)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {open
            ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            : <><path d="M4 6h16M4 12h16M4 18h7" /><circle cx="17.5" cy="17.5" r="3.5" /><path d="M17.5 16v1.5l1 1" strokeLinecap="round" /></>
          }
        </svg>
        {open ? "Close" : "Edit Layout"}
      </button>

      {/* Slide-over panel */}
      <div
        className="fixed top-0 right-0 h-full z-40 flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          width: "320px",
          transform: open ? "translateX(0)" : "translateX(100%)",
          background: "rgba(8, 5, 15, 0.97)",
          borderLeft: "1px solid var(--color-bg-border)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b shrink-0"
          style={{ borderColor: "var(--color-bg-border)" }}
        >
          <p className="font-cinzel text-xs tracking-[0.35em] uppercase" style={{ color: "var(--color-accent-arcane)" }}>
            Page Layout
          </p>
          <p className="text-base font-cinzel tracking-wider mt-0.5" style={{ color: "var(--color-text-primary)" }}>
            {pathname === "/" ? "Home" : pathname.replace(/^\//, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Drag sections to reorder them.
          </p>
        </div>

        {/* Sortable list */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {sections.map((section) => (
                  <SortableRow key={section.id} section={section} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Footer / save */}
        <div
          className="px-5 py-4 border-t shrink-0 space-y-2"
          style={{ borderColor: "var(--color-bg-border)" }}
        >
          <button
            onClick={handleSave}
            disabled={pending}
            className="w-full rounded py-2.5 font-cinzel text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
            style={{
              background: "var(--color-accent-arcane)",
              color: "#fff",
            }}
          >
            {pending ? "Saving…" : "Save Layout"}
          </button>
          {saved && (
            <p className="text-xs text-center" style={{ color: "#4ade80" }}>
              Saved — page will reflect new order.
            </p>
          )}
          <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
            Only visible to admins
          </p>
        </div>
      </div>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
