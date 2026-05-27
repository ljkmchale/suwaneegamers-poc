"use client";

import { useState, useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { savePageLayoutAction } from "@/app/admin/page-layout/actions";
import { PAGE_SECTIONS } from "@/lib/pageSections";
import { ASSET_TYPES, getAssetDef, type PageItem, type BlockItem, type AssetTypeDef } from "@/lib/pageBlocks";

// ── Prop edit form ────────────────────────────────────────────────────────────

function PropsForm({
  block,
  onChange,
}: {
  block: BlockItem;
  onChange: (props: Record<string, unknown>) => void;
}) {
  const def = getAssetDef(block.type);
  if (!def) return null;

  function set(key: string, value: string) {
    onChange({ ...block.props, [key]: value });
  }

  const INPUT = "w-full px-2.5 py-1.5 rounded border text-xs bg-[#08050f] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors";
  const BORDER = "border-[#2a2a35]";
  const LABEL = "block mb-1 text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060]";

  return (
    <div className="mt-2 space-y-2 px-1">
      {def.fields.map((field) => {
        const val = (block.props[field.key] as string) ?? "";
        if (field.type === "select") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              <select value={val} onChange={(e) => set(field.key, e.target.value)}
                className={`${INPUT} ${BORDER}`}>
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          );
        }
        if (field.type === "textarea") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              <textarea rows={3} value={val} placeholder={field.placeholder}
                onChange={(e) => set(field.key, e.target.value)}
                className={`${INPUT} ${BORDER} resize-y`} />
            </div>
          );
        }
        return (
          <div key={field.key}>
            <label className={LABEL}>{field.label}</label>
            <input type="text" value={val} placeholder={field.placeholder}
              onChange={(e) => set(field.key, e.target.value)}
              className={`${INPUT} ${BORDER}`} />
          </div>
        );
      })}
    </div>
  );
}

// ── Sortable layout row ───────────────────────────────────────────────────────

function LayoutRow({
  item,
  isEditing,
  onEdit,
  onDelete,
  onPropsChange,
}: {
  item: PageItem;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPropsChange: (props: Record<string, unknown>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.kind === "section" ? `section::${item.id}` : item.id });

  const isSection = item.kind === "section";
  const sectionMeta = isSection
    ? (PAGE_SECTIONS[usePathname()]?.find((s) => s.id === item.id))
    : null;
  const assetDef = !isSection ? getAssetDef((item as BlockItem).type) : null;

  const label = isSection
    ? (sectionMeta?.label ?? item.id)
    : (assetDef?.label ?? (item as BlockItem).type);
  const sub = isSection
    ? (sectionMeta?.description ?? "Built-in section")
    : (assetDef?.description ?? "");
  const icon = isSection ? "⊞" : (assetDef?.icon ?? "□");

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ${isEditing ? "border-[#8b5cf6] bg-[#16161e]" : "border-[#2a2a35] bg-[#0f0a1a] hover:border-[#3a3a45]"}`}>
        {/* Drag handle */}
        <span className="cursor-grab active:cursor-grabbing text-[#3a3a45] hover:text-[#5a5060] select-none text-lg shrink-0 transition-colors"
          {...attributes} {...listeners}>⠿</span>

        {/* Icon + labels */}
        <span className="text-base shrink-0 w-5 text-center" style={{ color: isSection ? "var(--color-accent-arcane)" : "var(--color-accent-gold)" }}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{label}</p>
          <p className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>{sub}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isSection && (
            <button onClick={onEdit} title="Edit properties"
              className="w-6 h-6 flex items-center justify-center rounded text-[#5a5060] hover:text-[#8b5cf6] hover:bg-[#16161e] transition-colors">
              ✎
            </button>
          )}
          {!isSection && (
            <button onClick={onDelete} title="Remove block"
              className="w-6 h-6 flex items-center justify-center rounded text-[#5a5060] hover:text-[#ef4444] hover:bg-[#16161e] transition-colors">
              ×
            </button>
          )}
        </div>
      </div>

      {/* Inline prop editor */}
      {isEditing && !isSection && (
        <div className="mt-1 mb-2 rounded-lg border border-[#2a2a35] bg-[#08050f] px-3 py-3">
          <PropsForm
            block={item as BlockItem}
            onChange={onPropsChange}
          />
        </div>
      )}
    </div>
  );
}

// ── Asset library panel ───────────────────────────────────────────────────────

function AssetLibrary({ onAdd }: { onAdd: (def: AssetTypeDef) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-cinzel tracking-widest uppercase mb-3" style={{ color: "var(--color-text-muted)" }}>
        Click to add to bottom of page
      </p>
      {ASSET_TYPES.map((def) => (
        <button
          key={def.type}
          onClick={() => onAdd(def)}
          className="w-full flex items-center gap-3 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-4 py-3 text-left hover:border-[#f59e0b] hover:bg-[#16161e] transition-colors group"
        >
          <span className="text-xl shrink-0 w-6 text-center" style={{ color: "var(--color-accent-gold)" }}>
            {def.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium group-hover:text-amber-400 transition-colors"
              style={{ color: "var(--color-text-primary)" }}>
              {def.label}
            </p>
            <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              {def.description}
            </p>
          </div>
          <span className="ml-auto text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>＋</span>
        </button>
      ))}
    </div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export function PageEditOverlay() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"layout" | "assets">("layout");
  const [items, setItems] = useState<PageItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const hasLayout = !!(PAGE_SECTIONS[pathname]?.length);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch current layout when panel opens or pathname changes
  useEffect(() => {
    if (!hasLayout) return;
    fetch(`/api/page-layout?page=${encodeURIComponent(pathname)}`)
      .then((r) => r.json())
      .then(({ items: fetched }: { items: PageItem[] }) => {
        setItems(fetched ?? []);
      })
      .catch(() => {
        const defaults = PAGE_SECTIONS[pathname]?.map((s) => ({ kind: "section" as const, id: s.id })) ?? [];
        setItems(defaults);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, open]);

  // Unique ID for dnd-kit (sections share id namespace with blocks — prefix to avoid collision)
  function itemDndId(item: PageItem) {
    return item.kind === "section" ? `section::${item.id}` : item.id;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => itemDndId(i) === active.id);
    const newIdx = items.findIndex((i) => itemDndId(i) === over.id);
    setItems(arrayMove(items, oldIdx, newIdx));
  }

  function handleAddBlock(def: AssetTypeDef) {
    const newBlock: BlockItem = {
      kind: "block",
      id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: def.type,
      props: { ...def.defaultProps },
    };
    setItems((prev) => [...prev, newBlock]);
    setTab("layout");
    setEditingId(newBlock.id);
  }

  function handleDeleteBlock(id: string) {
    setItems((prev) => prev.filter((i) => !(i.kind === "block" && i.id === id)));
    if (editingId === id) setEditingId(null);
  }

  function handlePropsChange(id: string, props: Record<string, unknown>) {
    setItems((prev) =>
      prev.map((i) => (i.kind === "block" && i.id === id ? { ...i, props } : i))
    );
  }

  function handleSave() {
    startTransition(async () => {
      await savePageLayoutAction(pathname, items);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  if (pathname.startsWith("/admin")) return null;
  if (!hasLayout) return null;

  const pageTitle = pathname === "/"
    ? "Home"
    : pathname.replace(/^\//, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const TAB_ACTIVE = { background: "var(--color-accent-arcane)", color: "#fff" };
  const TAB_IDLE   = { background: "transparent", color: "var(--color-text-muted)" };

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
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {open
            ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" d="M12 4v16M4 12h16" />
          }
        </svg>
        {open ? "Close" : "Edit Layout"}
      </button>

      {/* Slide-over panel */}
      <div
        className="fixed top-0 right-0 h-full z-40 flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          width: "340px",
          transform: open ? "translateX(0)" : "translateX(100%)",
          background: "rgba(8, 5, 15, 0.97)",
          borderLeft: "1px solid var(--color-bg-border)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--color-bg-border)" }}>
          <p className="font-cinzel text-[10px] tracking-[0.4em] uppercase mb-0.5"
            style={{ color: "var(--color-accent-arcane)" }}>
            Page Layout
          </p>
          <p className="text-base font-cinzel tracking-wider" style={{ color: "var(--color-text-primary)" }}>
            {pageTitle}
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 rounded-lg p-1" style={{ background: "var(--color-bg-card)" }}>
            {(["layout", "assets"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-1.5 rounded text-[10px] font-cinzel tracking-widest uppercase transition-colors"
                style={tab === t ? TAB_ACTIVE : TAB_IDLE}>
                {t === "layout" ? "⊞ Layout" : "＋ Assets"}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === "layout" ? (
            items.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: "var(--color-text-muted)" }}>
                Loading…
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={items.map(itemDndId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {items.map((item) => {
                      const dndId = itemDndId(item);
                      const blockId = item.kind === "block" ? item.id : null;
                      return (
                        <LayoutRow
                          key={dndId}
                          item={item}
                          isEditing={editingId === blockId}
                          onEdit={() => setEditingId(editingId === blockId ? null : blockId)}
                          onDelete={() => blockId && handleDeleteBlock(blockId)}
                          onPropsChange={(props) => blockId && handlePropsChange(blockId, props)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )
          ) : (
            <AssetLibrary onAdd={handleAddBlock} />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0 space-y-2" style={{ borderColor: "var(--color-bg-border)" }}>
          <button onClick={handleSave} disabled={pending}
            className="w-full rounded py-2.5 font-cinzel text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
            style={{ background: "var(--color-accent-arcane)", color: "#fff" }}>
            {pending ? "Saving…" : "Save Layout"}
          </button>
          {saved && (
            <p className="text-xs text-center" style={{ color: "#4ade80" }}>
              Saved — reload the page to see changes.
            </p>
          )}
          <p className="text-[10px] text-center" style={{ color: "var(--color-text-muted)" }}>
            Only visible to admins
          </p>
        </div>
      </div>

      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setOpen(false)} />
      )}
    </>
  );
}
