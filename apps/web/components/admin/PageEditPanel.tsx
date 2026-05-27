"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  ASSET_TYPES,
  getAssetDef,
  type AssetTypeDef,
  type BlockItem,
} from "@/lib/pageBlocks";

// ── Prop editor ───────────────────────────────────────────────────────────────

function PropsForm({
  block,
  onChange,
}: {
  block: BlockItem;
  onChange: (props: Record<string, unknown>) => void;
}) {
  const def = getAssetDef(block.type);
  if (!def)
    return null;
  if (def.fields.length === 0)
    return (
      <p className="text-[10px] text-[#5a5060] py-2">
        No configurable properties for this block.
      </p>
    );

  function set(key: string, value: string) {
    onChange({ ...block.props, [key]: value });
  }

  const INPUT =
    "w-full px-2.5 py-1.5 rounded border text-xs bg-[#08050f] text-[#e8dfc8] " +
    "placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors border-[#2a2a35]";
  const LABEL = "block mb-1 text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060]";

  return (
    <div className="space-y-3">
      {def.fields.map((field) => {
        const val = (block.props[field.key] as string) ?? "";
        if (field.type === "select") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              <select
                value={val}
                onChange={(e) => set(field.key, e.target.value)}
                className={INPUT}
              >
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        if (field.type === "textarea" || field.type === "json") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              {field.hint && (
                <p className="text-[10px] text-[#5a5060] mb-1">{field.hint}</p>
              )}
              <textarea
                rows={field.type === "json" ? 5 : 3}
                value={val}
                placeholder={field.placeholder}
                onChange={(e) => set(field.key, e.target.value)}
                className={`${INPUT} resize-y font-mono`}
              />
            </div>
          );
        }
        return (
          <div key={field.key}>
            <label className={LABEL}>{field.label}</label>
            <input
              type={field.type === "url" ? "url" : "text"}
              value={val}
              placeholder={field.placeholder}
              onChange={(e) => set(field.key, e.target.value)}
              className={INPUT}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Draggable asset tile ───────────────────────────────────────────────────────

function AssetTile({ def }: { def: AssetTypeDef }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new-asset::${def.type}`,
    data: { kind: "new-asset", assetType: def.type },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2.5 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-3 py-2 cursor-grab active:cursor-grabbing hover:border-[#f59e0b] hover:bg-[#16161e] transition-colors select-none ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <span className="text-sm shrink-0 w-4 text-center text-[#f59e0b]">
        {def.icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#e8dfc8] truncate">{def.label}</p>
        <p className="text-[10px] text-[#5a5060] truncate leading-tight">{def.description}</p>
      </div>
      <span className="ml-auto text-[#3a3a45] text-xs shrink-0 select-none">⠿</span>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface PageEditPanelProps {
  editingBlock: BlockItem | null;
  onPropsChange: (props: Record<string, unknown>) => void;
  onClearEdit: () => void;
  onSave: () => void;
  pending: boolean;
  saved: boolean;
  hasChanges: boolean;
  onClose: () => void;
}

export function PageEditPanel({
  editingBlock,
  onPropsChange,
  onClearEdit,
  onSave,
  pending,
  saved,
  hasChanges,
  onClose,
}: PageEditPanelProps) {
  const categories: { label: string; key: "layout" | "content" | "data" }[] = [
    { label: "Layout", key: "layout" },
    { label: "Content", key: "content" },
    { label: "Data", key: "data" },
  ];
  const byCategory = {
    layout: ASSET_TYPES.filter((a) => a.category === "layout"),
    content: ASSET_TYPES.filter((a) => a.category === "content"),
    data: ASSET_TYPES.filter((a) => a.category === "data"),
  };

  return (
    <div
      className="fixed top-0 right-0 h-full z-50 flex flex-col"
      style={{
        width: "288px",
        background: "rgba(8, 5, 15, 0.97)",
        borderLeft: "1px solid var(--color-bg-border)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-[#2a2a35] shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-cinzel text-[10px] tracking-[0.4em] uppercase text-[#8b5cf6]">
            Edit Layout
          </p>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded border border-[#2a2a35] text-[#5a5060] hover:text-[#e8dfc8] hover:border-[#5a5060] transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <button
          onClick={onSave}
          disabled={pending || !hasChanges}
          className="w-full py-2 rounded font-cinzel text-xs tracking-widest uppercase transition-colors disabled:opacity-40"
          style={{ background: "#8b5cf6", color: "#fff" }}
        >
          {pending ? "Saving…" : saved ? "Saved ✓" : "Save Layout"}
        </button>

        {hasChanges && !saved && !pending && (
          <p className="text-[10px] text-center text-[#f59e0b] -mt-1">
            Unsaved changes
          </p>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Props editor — shown when a block is selected */}
        {editingBlock && (
          <div className="px-4 py-4 border-b border-[#2a2a35]">
            <div className="flex items-center justify-between mb-3">
              <p className="font-cinzel text-[10px] tracking-widest uppercase text-[#a89880]">
                Edit Block
              </p>
              <button
                onClick={onClearEdit}
                className="text-[10px] text-[#5a5060] hover:text-[#a89880] transition-colors"
              >
                ← Back
              </button>
            </div>
            <div className="flex items-center gap-2 mb-3 p-2 rounded-lg border border-[#2a2a35] bg-[#0f0a1a]">
              <span className="text-sm text-[#f59e0b]">
                {getAssetDef(editingBlock.type)?.icon ?? "□"}
              </span>
              <span className="text-xs text-[#e8dfc8] font-medium">
                {getAssetDef(editingBlock.type)?.label ?? editingBlock.type}
              </span>
            </div>
            <PropsForm block={editingBlock} onChange={onPropsChange} />
          </div>
        )}

        {/* Asset library */}
        <div className="px-4 py-4">
          <p className="text-[10px] font-cinzel tracking-widest uppercase text-[#a89880] mb-1">
            Add Blocks
          </p>
          <p className="text-[10px] text-[#5a5060] mb-4 leading-relaxed">
            Drag onto the page to insert. Hover any block to see its drag handle and reorder.
          </p>

          {categories.map(({ label, key }) => (
            <div key={key} className="mb-5">
              <p className="text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060] mb-2">
                {label}
              </p>
              <div className="space-y-1.5">
                {byCategory[key].map((def) => (
                  <AssetTile key={def.type} def={def} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
