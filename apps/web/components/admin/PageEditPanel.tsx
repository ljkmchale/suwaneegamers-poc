"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type DragEvent } from "react";
import {
  useDraggable,
} from "@dnd-kit/core";
import { uploadFilesAction } from "@/app/admin/media/actions";
import {
  ASSET_TYPES,
  CARD_LAYOUT_ITEM_TYPES,
  PROFILE_CARD_ITEM_TYPES,
  getAssetDef,
  type AssetTypeDef,
  type BlockItem,
  type CardLayoutItem,
  type CardLayoutItemType,
  type ProfileCardItem,
  type ProfileCardItemType,
} from "@/lib/pageBlocks";

interface EditorMediaFile {
  path: string;
  name: string;
  size: number;
}

function MediaPickerDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}) {
  const [files, setFiles] = useState<EditorMediaFile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/media")
      .then((res) => res.ok ? res.json() : { files: [] })
      .then((data: { files?: EditorMediaFile[] }) => setFiles(data.files ?? []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [open]);

  const visibleFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return files;
    return files.filter((file) => file.path.toLowerCase().includes(needle));
  }, [files, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4">
      <div className="flex max-h-[82vh] w-full max-w-4xl flex-col rounded-lg border border-[#2a2a35] bg-[#08050f] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[#2a2a35] p-4">
          <div className="min-w-0 flex-1">
            <p className="font-cinzel text-xs tracking-widest uppercase text-[#8b5cf6]">Media Library</p>
            <p className="text-[11px] text-[#5a5060]">{files.length} image assets</p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search images"
            className="w-56 rounded border border-[#2a2a35] bg-[#0f0a1a] px-3 py-1.5 text-xs text-[#e8dfc8] outline-none transition-colors focus:border-[#8b5cf6]"
          />
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded border border-[#2a2a35] text-[#5a5060] transition-colors hover:border-[#5a5060] hover:text-[#e8dfc8]"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-[#5a5060]">Loading media...</p>
          ) : visibleFiles.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#5a5060]">No images found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {visibleFiles.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => {
                    onSelect(file.path);
                    onClose();
                  }}
                  className="group overflow-hidden rounded border border-[#2a2a35] bg-[#0f0a1a] text-left transition-colors hover:border-[#8b5cf6]"
                >
                  <div className="aspect-square bg-[#16161e]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={file.path} alt="" className="h-full w-full object-contain p-2" />
                  </div>
                  <div className="p-2">
                    <p className="truncate text-[11px] text-[#a89880]">{file.name}</p>
                    <p className="truncate text-[10px] text-[#5a5060]">{file.path}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImagePathField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    const fd = new FormData();
    fd.append("subfolder", "");
    fd.append("files", files[0]);

    startTransition(async () => {
      const result = await uploadFilesAction(fd);
      if (result.uploaded[0]) onChange(result.uploaded[0]);
      if (result.errors.length > 0) setError(result.errors.join(", "));
    });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (!isPending) upload(e.dataTransfer.files);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    upload(e.target.files);
  }

  const zoneClass =
    isPending ? "border-[#2a2a35] opacity-60 cursor-wait" :
    dragging ? "border-[#8b5cf6] bg-[#1a1025]" :
    "border-[#2a2a35] hover:border-[#8b5cf6]";

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          placeholder={placeholder ?? "/images/example.webp"}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded border text-xs bg-[#08050f] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors border-[#2a2a35]"
        />
        <button type="button" onClick={() => setPickerOpen(true)}
          className="px-2 rounded border border-[#2a2a35] text-[10px] text-[#a89880] hover:text-[#e8dfc8] hover:border-[#8b5cf6]">
          Browse
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")}
            className="px-2 rounded border border-[#2a2a35] text-[10px] text-[#5a5060] hover:text-[#ef4444] hover:border-[#ef4444]">
            Clear
          </button>
        )}
      </div>
      {value && (
        <div className="h-20 rounded border border-[#2a2a35] bg-[#16161e] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full object-contain" />
        </div>
      )}
      <div
        onClick={() => !isPending && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!isPending) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded border border-dashed px-2.5 py-2 text-center cursor-pointer transition-colors ${zoneClass}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.avif"
          className="sr-only"
          onChange={onFileChange}
        />
        <p className="text-[10px] text-[#a89880]">
          {isPending ? "Uploading..." : "Drop image or click to upload"}
        </p>
      </div>
      {error && <p className="text-[10px] text-[#ef4444]">{error}</p>}
      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onChange}
      />
    </div>
  );
}

// ── Profile card items editor ─────────────────────────────────────────────────

interface EditableLink {
  label?: string;
  title?: string;
  href?: string;
  description?: string;
}

interface EditableGalleryImage {
  src?: string;
  alt?: string;
  caption?: string;
}

interface EditableCharacter {
  name?: string;
  campaign?: string;
  dm?: string;
  url?: string;
}

interface EditableEntry {
  title?: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  url?: string;
}

function parseJsonList<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function saveJsonList<T>(onChange: (value: string) => void, next: T[]) {
  onChange(JSON.stringify(next, null, 2));
}

function moveListItem<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function LinksField({
  value,
  onChange,
  titleMode = false,
}: {
  value: string;
  onChange: (value: string) => void;
  titleMode?: boolean;
}) {
  const links = parseJsonList<EditableLink>(value);

  function save(next: EditableLink[]) {
    saveJsonList(onChange, next);
  }

  function setLink(index: number, key: keyof EditableLink, nextValue: string) {
    save(links.map((link, i) => i === index ? { ...link, [key]: nextValue } : link));
  }

  function addLink() {
    save([
      ...links,
      titleMode
        ? { title: "Link Title", description: "", href: "https://example.com", label: "Open" }
        : { label: "Link label", href: "https://example.com", description: "" },
    ]);
  }

  const INPUT =
    "w-full px-2 py-1 rounded border text-xs bg-[#08050f] text-[#e8dfc8] " +
    "placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors border-[#2a2a35]";
  const LABEL = "block mb-0.5 text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060]";

  return (
    <div className="space-y-2">
      {links.map((link, index) => (
        <div key={index} className="rounded border border-[#2a2a35] bg-[#0f0a1a] p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex-1 text-[10px] font-cinzel tracking-widest uppercase text-[#a89880]">
              Link {index + 1}
            </span>
            <button type="button" onClick={() => save(moveListItem(links, index, index - 1))} disabled={index === 0}
              className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5">Up</button>
            <button type="button" onClick={() => save(moveListItem(links, index, index + 1))} disabled={index === links.length - 1}
              className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5">Down</button>
            <button type="button" onClick={() => save(links.filter((_, i) => i !== index))}
              className="text-[11px] text-[#5a5060] hover:text-red-400 px-0.5">Remove</button>
          </div>

          <div>
            <label className={LABEL}>{titleMode ? "Title" : "Label"}</label>
            <input value={(titleMode ? link.title : link.label) ?? ""}
              onChange={(e) => setLink(index, titleMode ? "title" : "label", e.target.value)}
              className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>URL</label>
            <input type="url" value={link.href ?? ""} onChange={(e) => setLink(index, "href", e.target.value)}
              className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea rows={2} value={link.description ?? ""}
              onChange={(e) => setLink(index, "description", e.target.value)}
              className={`${INPUT} resize-y`} />
          </div>
          {titleMode && (
            <div>
              <label className={LABEL}>Button Label</label>
              <input value={link.label ?? ""} onChange={(e) => setLink(index, "label", e.target.value)}
                className={INPUT} />
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addLink}
        className="w-full rounded border border-[#2a2a35] px-2 py-1.5 text-[10px] font-cinzel tracking-widest uppercase text-[#a89880] transition-colors hover:border-[#8b5cf6] hover:text-[#e8dfc8]">
        Add Link
      </button>
    </div>
  );
}

function GalleryImagesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const images = parseJsonList<EditableGalleryImage>(value);

  function save(next: EditableGalleryImage[]) {
    saveJsonList(onChange, next);
  }

  function setImage(index: number, key: keyof EditableGalleryImage, nextValue: string) {
    save(images.map((image, i) => i === index ? { ...image, [key]: nextValue } : image));
  }

  const INPUT =
    "w-full px-2 py-1 rounded border text-xs bg-[#08050f] text-[#e8dfc8] " +
    "placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors border-[#2a2a35]";
  const LABEL = "block mb-0.5 text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060]";

  return (
    <div className="space-y-2">
      {images.map((image, index) => (
        <div key={index} className="rounded border border-[#2a2a35] bg-[#0f0a1a] p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex-1 text-[10px] font-cinzel tracking-widest uppercase text-[#a89880]">
              Image {index + 1}
            </span>
            <button type="button" onClick={() => save(moveListItem(images, index, index - 1))} disabled={index === 0}
              className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5">Up</button>
            <button type="button" onClick={() => save(moveListItem(images, index, index + 1))} disabled={index === images.length - 1}
              className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5">Down</button>
            <button type="button" onClick={() => save(images.filter((_, i) => i !== index))}
              className="text-[11px] text-[#5a5060] hover:text-red-400 px-0.5">Remove</button>
          </div>
          <div>
            <label className={LABEL}>Image</label>
            <ImagePathField value={image.src ?? ""} onChange={(next) => setImage(index, "src", next)} />
          </div>
          <div>
            <label className={LABEL}>Alt Text</label>
            <input value={image.alt ?? ""} onChange={(e) => setImage(index, "alt", e.target.value)}
              className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Caption</label>
            <input value={image.caption ?? ""} onChange={(e) => setImage(index, "caption", e.target.value)}
              className={INPUT} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => save([...images, { src: "", alt: "", caption: "" }])}
        className="w-full rounded border border-[#2a2a35] px-2 py-1.5 text-[10px] font-cinzel tracking-widest uppercase text-[#a89880] transition-colors hover:border-[#8b5cf6] hover:text-[#e8dfc8]">
        Add Image
      </button>
    </div>
  );
}

function CharactersField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const characters = parseJsonList<EditableCharacter>(value);

  function save(next: EditableCharacter[]) {
    saveJsonList(onChange, next);
  }

  function setCharacter(index: number, key: keyof EditableCharacter, nextValue: string) {
    save(characters.map((character, i) => i === index ? { ...character, [key]: nextValue } : character));
  }

  const INPUT =
    "w-full px-2 py-1 rounded border text-xs bg-[#08050f] text-[#e8dfc8] " +
    "placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors border-[#2a2a35]";
  const LABEL = "block mb-0.5 text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060]";

  return (
    <div className="space-y-2">
      {characters.map((character, index) => (
        <div key={index} className="rounded border border-[#2a2a35] bg-[#0f0a1a] p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex-1 text-[10px] font-cinzel tracking-widest uppercase text-[#a89880]">
              Character {index + 1}
            </span>
            <button type="button" onClick={() => save(moveListItem(characters, index, index - 1))} disabled={index === 0}
              className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5">Up</button>
            <button type="button" onClick={() => save(moveListItem(characters, index, index + 1))} disabled={index === characters.length - 1}
              className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5">Down</button>
            <button type="button" onClick={() => save(characters.filter((_, i) => i !== index))}
              className="text-[11px] text-[#5a5060] hover:text-red-400 px-0.5">Remove</button>
          </div>
          <div>
            <label className={LABEL}>Name</label>
            <input value={character.name ?? ""} onChange={(e) => setCharacter(index, "name", e.target.value)}
              className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Campaign</label>
            <input value={character.campaign ?? ""} onChange={(e) => setCharacter(index, "campaign", e.target.value)}
              className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>DM</label>
            <input value={character.dm ?? ""} onChange={(e) => setCharacter(index, "dm", e.target.value)}
              className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Character URL</label>
            <input type="url" value={character.url ?? ""} onChange={(e) => setCharacter(index, "url", e.target.value)}
              className={INPUT} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => save([...characters, { name: "New Character", campaign: "", dm: "", url: "" }])}
        className="w-full rounded border border-[#2a2a35] px-2 py-1.5 text-[10px] font-cinzel tracking-widest uppercase text-[#a89880] transition-colors hover:border-[#8b5cf6] hover:text-[#e8dfc8]">
        Add Character
      </button>
    </div>
  );
}

function EntriesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const entries = parseJsonList<EditableEntry>(value);

  function save(next: EditableEntry[]) {
    saveJsonList(onChange, next);
  }

  function setEntry(index: number, key: keyof EditableEntry, nextValue: string) {
    save(entries.map((entry, i) => i === index ? { ...entry, [key]: nextValue } : entry));
  }

  const INPUT =
    "w-full px-2 py-1 rounded border text-xs bg-[#08050f] text-[#e8dfc8] " +
    "placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors border-[#2a2a35]";
  const LABEL = "block mb-0.5 text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060]";

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <div key={index} className="rounded border border-[#2a2a35] bg-[#0f0a1a] p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex-1 text-[10px] font-cinzel tracking-widest uppercase text-[#a89880]">
              Entry {index + 1}
            </span>
            <button type="button" onClick={() => save(moveListItem(entries, index, index - 1))} disabled={index === 0}
              className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5">Up</button>
            <button type="button" onClick={() => save(moveListItem(entries, index, index + 1))} disabled={index === entries.length - 1}
              className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5">Down</button>
            <button type="button" onClick={() => save(entries.filter((_, i) => i !== index))}
              className="text-[11px] text-[#5a5060] hover:text-red-400 px-0.5">Remove</button>
          </div>
          {(["title", "subtitle", "meta", "status", "url"] as const).map((key) => (
            <div key={key}>
              <label className={LABEL}>{key === "url" ? "URL" : key}</label>
              <input type={key === "url" ? "url" : "text"} value={entry[key] ?? ""}
                onChange={(e) => setEntry(index, key, e.target.value)}
                className={INPUT} />
            </div>
          ))}
        </div>
      ))}
      <button type="button" onClick={() => save([...entries, { title: "New Entry", subtitle: "", meta: "", status: "", url: "" }])}
        className="w-full rounded border border-[#2a2a35] px-2 py-1.5 text-[10px] font-cinzel tracking-widest uppercase text-[#a89880] transition-colors hover:border-[#8b5cf6] hover:text-[#e8dfc8]">
        Add Entry
      </button>
    </div>
  );
}

function ItemsEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);

  let items: ProfileCardItem[] = [];
  try {
    const parsed = JSON.parse(value || "[]");
    if (Array.isArray(parsed)) items = parsed;
  } catch { /* malformed */ }

  function save(next: ProfileCardItem[]) {
    onChange(JSON.stringify(next));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    save(next);
  }

  function moveDown(idx: number) {
    if (idx === items.length - 1) return;
    const next = [...items];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    save(next);
  }

  function moveItem(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const from = items.findIndex((item) => item.id === draggedId);
    const to = items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    save(next);
  }

  function remove(id: string) {
    save(items.filter((item) => item.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function addItem(type: ProfileCardItemType) {
    const id = `${type}_${Math.random().toString(36).slice(2, 8)}`;
    const defaults: Record<string, unknown> = {};
    const def = PROFILE_CARD_ITEM_TYPES.find((d) => d.type === type);
    if (def) {
      for (const f of def.fields) defaults[f.key] = "";
      if (type === "badge") defaults.color = "arcane";
      if (type === "image") defaults.shape = "wide";
      if (type === "portrait") defaults.position = "fixed";
    }
    save([...items, { id, type, props: defaults }]);
    setExpandedId(id);
  }

  function setProp(id: string, key: string, val: string) {
    save(items.map((item) => item.id === id ? { ...item, props: { ...item.props, [key]: val } } : item));
  }

  const INPUT =
    "w-full px-2 py-1 rounded border text-xs bg-[#08050f] text-[#e8dfc8] " +
    "placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors border-[#2a2a35]";
  const LABEL = "block mb-0.5 text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060]";

  return (
    <div className="space-y-1.5">
      {items.length === 0 && (
        <p className="text-[10px] text-[#5a5060] py-1">No elements yet — add one below.</p>
      )}

      {items.map((item, idx) => {
        const def = PROFILE_CARD_ITEM_TYPES.find((d) => d.type === item.type);
        const isExpanded = expandedId === item.id;
        const preview =
          (item.props.value as string | undefined) ||
          (item.props.name  as string | undefined) ||
          (item.props.playerName as string | undefined) ||
          (item.props.label as string | undefined) || "";

        return (
          <div
            key={item.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const draggedId = e.dataTransfer.getData("text/profile-card-item") || draggingItemId;
              if (draggedId) moveItem(draggedId, item.id);
              setDraggingItemId(null);
            }}
            className={`rounded border bg-[#0f0a1a] overflow-hidden transition-colors ${
              draggingItemId === item.id ? "border-[#8b5cf6] opacity-60" : "border-[#2a2a35]"
            }`}
          >
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/profile-card-item", item.id);
                  setDraggingItemId(item.id);
                }}
                onDragEnd={() => setDraggingItemId(null)}
                className="text-[12px] w-4 text-center shrink-0 cursor-grab active:cursor-grabbing select-none text-[#5a5060] hover:text-[#a89880]"
                aria-label={`Drag ${def?.label ?? item.type}`}
                title="Drag to reorder"
              >
                ::
              </button>
              <span className="text-[11px] w-4 text-center shrink-0 select-none">{def?.icon}</span>
              <span className="text-[10px] font-cinzel tracking-widest uppercase text-[#a89880] flex-1 truncate min-w-0">
                {def?.label}{preview ? ` — ${preview.slice(0, 22)}` : ""}
              </span>
              <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="text-[10px] text-[#5a5060] hover:text-[#a89880] px-1 transition-colors shrink-0">
                {isExpanded ? "▲" : "▼"}
              </button>
              <button onClick={() => moveUp(idx)} disabled={idx === 0}
                className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5 transition-colors shrink-0">↑</button>
              <button onClick={() => moveDown(idx)} disabled={idx === items.length - 1}
                className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5 transition-colors shrink-0">↓</button>
              <button onClick={() => remove(item.id)}
                className="text-[11px] text-[#5a5060] hover:text-red-400 px-0.5 transition-colors shrink-0">×</button>
            </div>

            {isExpanded && def && (
              <div className="px-2 pb-2 space-y-1.5 border-t border-[#2a2a35] pt-1.5">
                {def.fields.length === 0 && (
                  <p className="text-[10px] text-[#5a5060]">No properties.</p>
                )}
                {def.fields.map((field) => {
                  const val = (item.props[field.key] as string) ?? "";
                  if (field.type === "select") {
                    return (
                      <div key={field.key}>
                        <label className={LABEL}>{field.label}</label>
                        <select value={val} onChange={(e) => setProp(item.id, field.key, e.target.value)}
                          className={INPUT}>
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
                        <textarea rows={2} value={val}
                          onChange={(e) => setProp(item.id, field.key, e.target.value)}
                          className={`${INPUT} resize-y font-mono`} />
                      </div>
                    );
                  }
                  if (field.type === "image") {
                    return (
                      <div key={field.key}>
                        <label className={LABEL}>{field.label}</label>
                        <ImagePathField value={val} onChange={(next) => setProp(item.id, field.key, next)} />
                      </div>
                    );
                  }
                  if (field.type === "characters") {
                    return (
                      <div key={field.key}>
                        <label className={LABEL}>{field.label}</label>
                        <CharactersField value={val} onChange={(next) => setProp(item.id, field.key, next)} />
                      </div>
                    );
                  }
                  if (field.type === "entries") {
                    return (
                      <div key={field.key}>
                        <label className={LABEL}>{field.label}</label>
                        <EntriesField value={val} onChange={(next) => setProp(item.id, field.key, next)} />
                      </div>
                    );
                  }
                  return (
                    <div key={field.key}>
                      <label className={LABEL}>{field.label}</label>
                      <input type={field.type === "url" ? "url" : "text"} value={val}
                        onChange={(e) => setProp(item.id, field.key, e.target.value)}
                        className={INPUT} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-0.5">
        <p className="text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060] mb-1">Add element</p>
        <div className="flex flex-wrap gap-1">
          {PROFILE_CARD_ITEM_TYPES.map((def) => (
            <button key={def.type} onClick={() => addItem(def.type)}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[#2a2a35] text-[#5a5060] hover:text-[#e8dfc8] hover:border-[#8b5cf6] transition-colors">
              <span>{def.icon}</span>
              <span className="font-cinzel tracking-widest uppercase">{def.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Prop editor ───────────────────────────────────────────────────────────────

function CardLayoutItemsEditor({
  value,
  onChange,
  depth = 0,
}: {
  value: string;
  onChange: (v: string) => void;
  depth?: number;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);

  let items: CardLayoutItem[] = [];
  try {
    const parsed = JSON.parse(value || "[]");
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    items = [];
  }

  function save(next: CardLayoutItem[]) {
    onChange(JSON.stringify(next, null, 2));
  }

  function moveItem(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const from = items.findIndex((item) => item.id === draggedId);
    const to = items.findIndex((item) => item.id === targetId);
    if (from === -1 || to === -1) return;
    save(moveListItem(items, from, to));
  }

  function addItem(type: CardLayoutItemType) {
    const id = `${type}_${Math.random().toString(36).slice(2, 8)}`;
    const defaults: Record<string, unknown> = {};
    const def = CARD_LAYOUT_ITEM_TYPES.find((d) => d.type === type);
    if (def) {
      for (const f of def.fields) defaults[f.key] = "";
      if (type === "grid") {
        defaults.columns = "2";
        defaults.rows = "2";
        defaults.gap = "md";
        defaults.items = "[]";
      }
      if (type === "header") defaults.size = "md";
      if (type === "image") defaults.fit = "cover";
      if (type === "inner-card") defaults.items = "[]";
    }
    save([...items, { id, type, props: defaults }]);
    setExpandedId(id);
  }

  function setProp(id: string, key: string, val: string) {
    save(items.map((item) => item.id === id ? { ...item, props: { ...item.props, [key]: val } } : item));
  }

  const INPUT =
    "w-full px-2 py-1 rounded border text-xs bg-[#08050f] text-[#e8dfc8] " +
    "placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors border-[#2a2a35]";
  const LABEL = "block mb-0.5 text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060]";

  return (
    <div className={`space-y-1.5 ${depth > 0 ? "rounded border border-[#2a2a35] bg-[#08050f] p-2" : ""}`}>
      {items.length === 0 && (
        <p className="text-[10px] text-[#5a5060] py-1">No card layout elements yet.</p>
      )}

      {items.map((item, idx) => {
        const def = CARD_LAYOUT_ITEM_TYPES.find((d) => d.type === item.type);
        const isExpanded = expandedId === item.id;
        const preview =
          (item.props.title as string | undefined) ||
          (item.props.eyebrow as string | undefined) ||
          (item.props.content as string | undefined) ||
          (item.props.alt as string | undefined) || "";

        return (
          <div
            key={item.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const draggedId = e.dataTransfer.getData("text/card-layout-item") || draggingItemId;
              if (draggedId) moveItem(draggedId, item.id);
              setDraggingItemId(null);
            }}
            className={`rounded border bg-[#0f0a1a] overflow-hidden transition-colors ${
              draggingItemId === item.id ? "border-[#8b5cf6] opacity-60" : "border-[#2a2a35]"
            }`}
          >
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/card-layout-item", item.id);
                  setDraggingItemId(item.id);
                }}
                onDragEnd={() => setDraggingItemId(null)}
                className="text-[12px] w-4 text-center shrink-0 cursor-grab active:cursor-grabbing select-none text-[#5a5060] hover:text-[#a89880]"
                aria-label={`Drag ${def?.label ?? item.type}`}
                title="Drag to reorder"
              >
                ::
              </button>
              <span className="text-[11px] w-5 text-center shrink-0 select-none">{def?.icon}</span>
              <span className="text-[10px] font-cinzel tracking-widest uppercase text-[#a89880] flex-1 truncate min-w-0">
                {def?.label}{preview ? ` - ${preview.slice(0, 22)}` : ""}
              </span>
              <button type="button" onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="text-[10px] text-[#5a5060] hover:text-[#a89880] px-1 transition-colors shrink-0">
                {isExpanded ? "Hide" : "Edit"}
              </button>
              <button type="button" onClick={() => save(moveListItem(items, idx, idx - 1))} disabled={idx === 0}
                className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5 transition-colors shrink-0">Up</button>
              <button type="button" onClick={() => save(moveListItem(items, idx, idx + 1))} disabled={idx === items.length - 1}
                className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5 transition-colors shrink-0">Down</button>
              <button type="button" onClick={() => save(items.filter((i) => i.id !== item.id))}
                className="text-[11px] text-[#5a5060] hover:text-red-400 px-0.5 transition-colors shrink-0">X</button>
            </div>

            {isExpanded && def && (
              <div className="px-2 pb-2 space-y-1.5 border-t border-[#2a2a35] pt-1.5">
                {def.fields.map((field) => {
                  const val = (item.props[field.key] as string) ?? "";
                  if (field.type === "select") {
                    return (
                      <div key={field.key}>
                        <label className={LABEL}>{field.label}</label>
                        <select value={val} onChange={(e) => setProp(item.id, field.key, e.target.value)}
                          className={INPUT}>
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
                        <textarea rows={3} value={val}
                          onChange={(e) => setProp(item.id, field.key, e.target.value)}
                          className={`${INPUT} resize-y`} />
                      </div>
                    );
                  }
                  if (field.type === "image") {
                    return (
                      <div key={field.key}>
                        <label className={LABEL}>{field.label}</label>
                        <ImagePathField value={val} onChange={(next) => setProp(item.id, field.key, next)} />
                      </div>
                    );
                  }
                  if (field.type === "card-layout-items") {
                    return (
                      <div key={field.key}>
                        <label className={LABEL}>{field.label}</label>
                        <CardLayoutItemsEditor value={val} onChange={(next) => setProp(item.id, field.key, next)} depth={depth + 1} />
                      </div>
                    );
                  }
                  return (
                    <div key={field.key}>
                      <label className={LABEL}>{field.label}</label>
                      <input value={val}
                        onChange={(e) => setProp(item.id, field.key, e.target.value)}
                        className={INPUT} />
                      {field.hint && <p className="mt-0.5 text-[10px] text-[#5a5060]">{field.hint}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-0.5">
        <p className="text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060] mb-1">Add card element</p>
        <div className="flex flex-wrap gap-1">
          {CARD_LAYOUT_ITEM_TYPES.map((def) => (
            <button key={def.type} type="button" onClick={() => addItem(def.type)}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[#2a2a35] text-[#5a5060] hover:text-[#e8dfc8] hover:border-[#8b5cf6] transition-colors">
              <span>{def.icon}</span>
              <span className="font-cinzel tracking-widest uppercase">{def.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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
        if (field.type === "items") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              {field.hint && <p className="text-[10px] text-[#5a5060] mb-1">{field.hint}</p>}
              <ItemsEditor value={val} onChange={(v) => set(field.key, v)} />
            </div>
          );
        }
        if (field.type === "card-layout-items") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              {field.hint && <p className="text-[10px] text-[#5a5060] mb-1">{field.hint}</p>}
              <CardLayoutItemsEditor value={val} onChange={(v) => set(field.key, v)} />
            </div>
          );
        }
        if (field.type === "image") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              {field.hint && (
                <p className="text-[10px] text-[#5a5060] mb-1">{field.hint}</p>
              )}
              <ImagePathField
                value={val}
                onChange={(next) => set(field.key, next)}
                placeholder={field.placeholder}
              />
            </div>
          );
        }
        if (field.type === "json" && field.key === "links" && block.type === "portal-links") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              {field.hint && (
                <p className="text-[10px] text-[#5a5060] mb-1">{field.hint}</p>
              )}
              <LinksField value={val} onChange={(next) => set(field.key, next)} titleMode />
            </div>
          );
        }
        if (field.type === "json" && field.key === "links" && block.type === "link-list") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              {field.hint && (
                <p className="text-[10px] text-[#5a5060] mb-1">{field.hint}</p>
              )}
              <LinksField value={val} onChange={(next) => set(field.key, next)} />
            </div>
          );
        }
        if (field.type === "json" && field.key === "images" && block.type === "gallery") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              {field.hint && (
                <p className="text-[10px] text-[#5a5060] mb-1">{field.hint}</p>
              )}
              <GalleryImagesField value={val} onChange={(next) => set(field.key, next)} />
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
  const categories: { label: string; key: "layout" | "content" }[] = [
    { label: "Layout", key: "layout" },
    { label: "Content", key: "content" },
  ];
  const byCategory = {
    layout: ASSET_TYPES.filter((a) => a.category === "layout"),
    content: ASSET_TYPES.filter((a) => a.category === "content"),
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
