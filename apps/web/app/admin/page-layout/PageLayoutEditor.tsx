"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
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

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findSectionByItemId(sections: NavSection[], itemId: string) {
  return sections.find((s) => s.items.some((i) => i.id === itemId)) ?? null;
}

function findSectionById(sections: NavSection[], sectionId: string) {
  return sections.find((s) => s.id === sectionId) ?? null;
}

// ── Drag overlay card ─────────────────────────────────────────────────────────

function DragCard({ item }: { item: NavItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#8b5cf6] bg-[#1a0f2e] shadow-xl rotate-1 opacity-95">
      <span className="text-[#8b5cf6] text-xl leading-none select-none">⠿</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.label}</p>
        <p className="text-xs text-[#5a5060] font-mono truncate">{item.href}</p>
      </div>
    </div>
  );
}

// ── Single draggable nav item ─────────────────────────────────────────────────

function SortableNavItem({
  item,
  onDelete,
  onUpdate,
}: {
  item: NavItem;
  onDelete: () => void;
  onUpdate: (updated: NavItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [href, setHref] = useState(item.href);
  const [errors, setErrors] = useState<{ label?: string; href?: string }>({});

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isExternal = item.href.startsWith("http://") || item.href.startsWith("https://");

  function validate() {
    const errs: { label?: string; href?: string } = {};
    if (!label.trim()) errs.label = "Label is required";
    if (!href.trim()) errs.href = "URL / path is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function commitEdit() {
    if (!validate()) return;
    onUpdate({ ...item, label: label.trim(), href: href.trim() });
    setEditing(false);
    setErrors({});
  }

  function cancelEdit() {
    setLabel(item.label);
    setHref(item.href);
    setEditing(false);
    setErrors({});
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] hover:border-[#3a3a45] transition-colors"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          suppressHydrationWarning
          className="cursor-grab active:cursor-grabbing text-[#3a3a45] hover:text-[#5a5060] select-none text-xl leading-none transition-colors shrink-0"
          title="Drag to reorder or move to another section"
          {...attributes}
          {...listeners}
        >
          ⠿
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.label}</p>
          <p className="text-xs text-[#5a5060] font-mono truncate">{item.href}</p>
        </div>

        {isExternal && (
          <span className="shrink-0 text-xs text-[#5a5060] border border-[#2a2a35] rounded px-1.5 py-0.5">
            ↗ ext
          </span>
        )}

        <button
          onClick={() => { setEditing((e) => !e); setErrors({}); }}
          className="shrink-0 text-xs text-[#5a5060] hover:text-[#a78bfa] border border-[#2a2a35] hover:border-[#5a3a8a] rounded px-2 py-1 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="shrink-0 text-xs text-[#5a5060] hover:text-red-400 border border-[#2a2a35] hover:border-red-800 rounded px-2 py-1 transition-colors"
        >
          ✕
        </button>
      </div>

      {editing && (
        <div className="border-t border-[#2a2a35] px-4 py-3 space-y-3 bg-[#0a0612]">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-[#5a5060] uppercase tracking-wide">Label</label>
              <input
                value={label}
                onChange={(e) => { setLabel(e.target.value); if (errors.label) setErrors((p) => ({ ...p, label: undefined })); }}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                className={`mt-1 w-full bg-[#1a1425] border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#8b5cf6] ${errors.label ? "border-red-500" : "border-[#2a2a35]"}`}
                placeholder="Link label"
              />
              {errors.label && <p className="mt-1 text-xs text-red-400">{errors.label}</p>}
            </div>
            <div className="flex-1">
              <label className="text-xs text-[#5a5060] uppercase tracking-wide">URL / Path</label>
              <input
                value={href}
                onChange={(e) => { setHref(e.target.value); if (errors.href) setErrors((p) => ({ ...p, href: undefined })); }}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                className={`mt-1 w-full bg-[#1a1425] border rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#8b5cf6] ${errors.href ? "border-red-500" : "border-[#2a2a35]"}`}
                placeholder="/path or https://..."
              />
              {errors.href && <p className="mt-1 text-xs text-red-400">{errors.href}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={commitEdit} className="text-xs px-3 py-1 rounded bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors">
              Apply
            </button>
            <button onClick={cancelEdit} className="text-xs px-3 py-1 rounded border border-[#2a2a35] text-[#5a5060] hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add item form ─────────────────────────────────────────────────────────────

function AddItemForm({ onAdd }: { onAdd: (item: NavItem) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [errors, setErrors] = useState<{ label?: string; href?: string }>({});

  function validate() {
    const errs: { label?: string; href?: string } = {};
    if (!label.trim()) errs.label = "Label is required";
    if (!href.trim()) errs.href = "URL / path is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onAdd({
      id: slugify(label.trim()) + "-" + Math.random().toString(36).slice(2, 6),
      label: label.trim(),
      href: href.trim(),
    });
    setLabel("");
    setHref("");
    setErrors({});
    setOpen(false);
  }

  function cancel() {
    setOpen(false);
    setLabel("");
    setHref("");
    setErrors({});
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full mt-2 py-2 rounded border border-dashed border-[#2a2a35] text-[#5a5060] hover:border-[#5a3a8a] hover:text-[#a78bfa] text-xs transition-colors"
      >
        + Add item
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-[#5a3a8a] bg-[#0a0612] px-4 py-3 space-y-3">
      <p className="text-xs text-[#a78bfa] font-cinzel uppercase tracking-wide">New item</p>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-[#5a5060] uppercase tracking-wide">Label</label>
          <input
            autoFocus
            value={label}
            onChange={(e) => { setLabel(e.target.value); if (errors.label) setErrors((p) => ({ ...p, label: undefined })); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
            className={`mt-1 w-full bg-[#1a1425] border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#8b5cf6] ${errors.label ? "border-red-500" : "border-[#2a2a35]"}`}
            placeholder="Link label"
          />
          {errors.label && <p className="mt-1 text-xs text-red-400">{errors.label}</p>}
        </div>
        <div className="flex-1">
          <label className="text-xs text-[#5a5060] uppercase tracking-wide">URL / Path</label>
          <input
            value={href}
            onChange={(e) => { setHref(e.target.value); if (errors.href) setErrors((p) => ({ ...p, href: undefined })); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
            className={`mt-1 w-full bg-[#1a1425] border rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#8b5cf6] ${errors.href ? "border-red-500" : "border-[#2a2a35]"}`}
            placeholder="/path or https://..."
          />
          {errors.href && <p className="mt-1 text-xs text-red-400">{errors.href}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs px-3 py-1 rounded bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors">
          Add
        </button>
        <button onClick={cancel} className="text-xs px-3 py-1 rounded border border-[#2a2a35] text-[#5a5060] hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Section panel (droppable + sortable list) ─────────────────────────────────

function NavSectionPanel({
  section,
  onChange,
  onDelete,
  onLabelChange,
}: {
  section: NavSection;
  onChange: (items: NavItem[]) => void;
  onDelete: () => void;
  onLabelChange: (label: string) => void;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(section.label);
  const [labelError, setLabelError] = useState("");

  const { setNodeRef, isOver } = useDroppable({ id: section.id });

  function commitLabelEdit() {
    const t = labelDraft.trim();
    if (!t) { setLabelError("Section name is required"); return; }
    onLabelChange(t);
    setEditingLabel(false);
    setLabelError("");
  }

  function cancelLabelEdit() {
    setLabelDraft(section.label);
    setEditingLabel(false);
    setLabelError("");
  }

  function handleDelete(itemId: string) {
    onChange(section.items.filter((i) => i.id !== itemId));
  }

  function handleUpdate(updated: NavItem) {
    onChange(section.items.map((i) => (i.id === updated.id ? updated : i)));
  }

  function handleAdd(item: NavItem) {
    onChange([...section.items, item]);
  }

  return (
    <section>
      {/* Section header */}
      <div className="mb-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {editingLabel ? (
            <div>
              <input
                autoFocus
                value={labelDraft}
                onChange={(e) => { setLabelDraft(e.target.value); setLabelError(""); }}
                onBlur={commitLabelEdit}
                onKeyDown={(e) => { if (e.key === "Enter") commitLabelEdit(); if (e.key === "Escape") cancelLabelEdit(); }}
                className={`font-cinzel text-base tracking-widest uppercase text-[#f59e0b] bg-transparent border-b focus:outline-none w-full ${labelError ? "border-red-500" : "border-[#f59e0b]"}`}
              />
              {labelError && <p className="mt-1 text-xs text-red-400">{labelError}</p>}
            </div>
          ) : (
            <h2
              className="font-cinzel text-base tracking-widest uppercase text-[#f59e0b] cursor-pointer hover:text-[#fbbf24] transition-colors inline-flex items-center gap-2"
              onClick={() => { setEditingLabel(true); setLabelDraft(section.label); }}
              title="Click to rename"
            >
              {section.label}
              <span className="text-xs normal-case font-sans tracking-normal opacity-40">✎</span>
            </h2>
          )}
          <p className="text-xs text-[#5a5060] mt-0.5">
            Drag the <span className="font-mono">⠿</span> handle to reorder — or drag to a different section below.
          </p>
        </div>

        <button
          onClick={onDelete}
          className="shrink-0 mt-0.5 text-xs text-[#5a5060] hover:text-red-400 border border-[#2a2a35] hover:border-red-800 rounded px-2 py-1 transition-colors"
        >
          Delete section
        </button>
      </div>

      {/* Droppable + sortable item list */}
      <div
        ref={setNodeRef}
        className={`min-h-[52px] rounded-lg transition-colors ${isOver ? "ring-2 ring-[#8b5cf6] ring-inset bg-[#1a0f2e]/30" : ""}`}
      >
        <SortableContext
          items={section.items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {section.items.length === 0 && (
              <div className="py-4 text-center text-xs text-[#3a3a45] border border-dashed border-[#2a2a35] rounded-lg">
                Drop items here
              </div>
            )}
            {section.items.map((item) => (
              <SortableNavItem
                key={item.id}
                item={item}
                onDelete={() => handleDelete(item.id)}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      <AddItemForm onAdd={handleAdd} />
    </section>
  );
}

// ── Add section form ──────────────────────────────────────────────────────────

function AddSectionForm({ onAdd }: { onAdd: (section: NavSection) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  function submit() {
    const t = label.trim();
    if (!t) { setError("Section name is required"); return; }
    onAdd({ id: slugify(t) + "-" + Math.random().toString(36).slice(2, 6), label: t, items: [] });
    setLabel("");
    setError("");
    setOpen(false);
  }

  function cancel() { setOpen(false); setLabel(""); setError(""); }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 rounded border border-dashed border-[#2a2a35] text-[#5a5060] hover:border-[#5a3a8a] hover:text-[#a78bfa] text-xs transition-colors"
      >
        + Add menu section
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[#5a3a8a] bg-[#0a0612] px-4 py-3 space-y-3">
      <p className="text-xs text-[#a78bfa] font-cinzel uppercase tracking-wide">New section</p>
      <div>
        <label className="text-xs text-[#5a5060] uppercase tracking-wide">Section name</label>
        <input
          autoFocus
          value={label}
          onChange={(e) => { setLabel(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
          className={`mt-1 w-full bg-[#1a1425] border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#8b5cf6] ${error ? "border-red-500" : "border-[#2a2a35]"}`}
          placeholder="e.g. Community"
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs px-3 py-1 rounded bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors">
          Add section
        </button>
        <button onClick={cancel} className="text-xs px-3 py-1 rounded border border-[#2a2a35] text-[#5a5060] hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Top-level editor ──────────────────────────────────────────────────────────

export function PageLayoutEditor({ initial }: { initial: NavSection[] }) {
  const [sections, setSections] = useState<NavSection[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeItem =
    activeId
      ? sections.flatMap((s) => s.items).find((i) => i.id === activeId) ?? null
      : null;

  // ── Drag handlers ────────────────────────────────────────────────────────

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    setSections((prev) => {
      const activeSection = findSectionByItemId(prev, activeId);
      if (!activeSection) return prev;

      const overSection =
        findSectionByItemId(prev, overId) ?? findSectionById(prev, overId);
      if (!overSection || activeSection.id === overSection.id) return prev;

      const item = activeSection.items.find((i) => i.id === activeId)!;
      const overItemIndex = overSection.items.findIndex((i) => i.id === overId);
      const insertAt = overItemIndex >= 0 ? overItemIndex : overSection.items.length;

      return prev.map((s) => {
        if (s.id === activeSection.id) return { ...s, items: s.items.filter((i) => i.id !== activeId) };
        if (s.id === overSection.id) {
          const next = [...s.items];
          next.splice(insertAt, 0, item);
          return { ...s, items: next };
        }
        return s;
      });
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    setSections((prev) => {
      const activeSection = findSectionByItemId(prev, activeId);
      const overSection = findSectionByItemId(prev, overId);
      if (!activeSection || !overSection || activeSection.id !== overSection.id) return prev;

      const oldIdx = activeSection.items.findIndex((i) => i.id === activeId);
      const newIdx = overSection.items.findIndex((i) => i.id === overId);
      if (oldIdx < 0 || newIdx < 0) return prev;

      return prev.map((s) =>
        s.id === activeSection.id ? { ...s, items: arrayMove(s.items, oldIdx, newIdx) } : s
      );
    });
  }

  // ── Section mutations ────────────────────────────────────────────────────

  function handleSectionChange(sectionId: string, items: NavItem[]) {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, items } : s)));
  }

  function handleSectionLabelChange(sectionId: string, label: string) {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, label } : s)));
  }

  function handleDeleteSection(sectionId: string) {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  }

  function handleAddSection(section: NavSection) {
    setSections((prev) => [...prev, section]);
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  function handleSave() {
    setSaveError("");
    startTransition(async () => {
      try {
        await saveNavLayoutAction(sections);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed — please try again.");
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-10">
        {sections.map((section) => (
          <NavSectionPanel
            key={section.id}
            section={section}
            onChange={(items) => handleSectionChange(section.id, items)}
            onDelete={() => handleDeleteSection(section.id)}
            onLabelChange={(label) => handleSectionLabelChange(section.id, label)}
          />
        ))}

        <AddSectionForm onAdd={handleAddSection} />

        {/* Save bar */}
        <div className="flex items-center gap-4 pt-6 border-t border-[#2a2a35]">
          <button
            onClick={handleSave}
            disabled={pending}
            className="px-6 py-2.5 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save Layout"}
          </button>
          {saved && <p className="text-sm text-green-400">Saved! The public navbar will reflect your changes.</p>}
          {saveError && <p className="text-sm text-red-400">{saveError}</p>}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? <DragCard item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
