"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type DragEvent } from "react";
import {
  parseCardLayoutProps,
  saveCardLayoutItems,
  findFreeCell,
  GRID_TYPE_META,
  CARD_LAYOUT_MAX_ROWS,
} from "./CardLayoutGridEditor";
import {
  useDraggable,
} from "@dnd-kit/core";
import { uploadFilesAction } from "@/app/admin/media/actions";
import {
  ACTIVE_ASSET_TYPES,
  CARD_LAYOUT_ITEM_TYPES,
  PROFILE_CARD_ITEM_TYPES,
  getAssetDef,
  type AssetTypeDef,
  type BlockItem,
  type BlockType,
  type CardLayoutItem,
  type CardLayoutItemType,
  type ProfileCardItem,
  type ProfileCardItemType,
  type PageGridMeta,
} from "@/lib/pageBlocks";

interface EditorMediaFile {
  path: string;
  name: string;
  size: number;
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".flac"];
const VIDEO_EXTENSIONS = [".mp4", ".m4v", ".mov", ".ogv", ".webm"];

function hasExtension(filePath: string, extensions: string[]) {
  return extensions.some((ext) => filePath.toLowerCase().endsWith(ext));
}

function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  allowMedia = false,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  allowMedia?: boolean;
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
    const allowed = allowMedia ? [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS] : IMAGE_EXTENSIONS;
    return files.filter((file) =>
      hasExtension(file.path, allowed) &&
      (!needle || file.path.toLowerCase().includes(needle))
    );
  }, [allowMedia, files, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4">
      <div className="flex max-h-[82vh] w-full max-w-4xl flex-col rounded-lg border border-[#2a2a35] bg-[#08050f] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[#2a2a35] p-4">
          <div className="min-w-0 flex-1">
            <p className="font-cinzel text-xs tracking-widest uppercase text-[#8b5cf6]">Media Library</p>
            <p className="text-[11px] text-[#5a5060]">{visibleFiles.length} {allowMedia ? "audio and video" : "image"} assets</p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={allowMedia ? "Search audio or video" : "Search images"}
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
            <p className="py-10 text-center text-sm text-[#5a5060]">No matching media found.</p>
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
                  <div className="aspect-square bg-[#16161e] flex items-center justify-center p-2">
                    {hasExtension(file.path, AUDIO_EXTENSIONS) ? (
                      <audio controls preload="metadata" src={file.path} className="w-full" />
                    ) : hasExtension(file.path, VIDEO_EXTENSIONS) ? (
                      <video controls preload="metadata" src={file.path} className="max-h-full max-w-full" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.path} alt="" className="h-full w-full object-contain p-2" />
                    )}
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
  accept = ".jpg,.jpeg,.png,.webp,.gif,.svg,.avif",
  dropLabel = "Drop image or click to upload",
  previewMedia = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  accept?: string;
  dropLabel?: string;
  previewMedia?: boolean;
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
          {previewMedia && /\.(mp3|wav|m4a|ogg|flac)(?:[?#].*)?$/i.test(value) ? (
            <audio controls preload="metadata" src={value} className="h-full w-full" />
          ) : previewMedia && /\.(mp4|m4v|mov|ogv|webm)(?:[?#].*)?$/i.test(value) ? (
            <video controls preload="metadata" src={value} className="h-full w-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          )}
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
          accept={accept}
          className="sr-only"
          onChange={onFileChange}
        />
        <p className="text-[10px] text-[#a89880]">
          {isPending ? "Uploading..." : dropLabel}
        </p>
      </div>
      {error && <p className="text-[10px] text-[#ef4444]">{error}</p>}
      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onChange}
        allowMedia={previewMedia}
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

interface EditableTimelineEntry {
  date?: string;
  title?: string;
  description?: string;
  events?: string[];
}

function parseJsonList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string") return [];
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

function TimelineEntriesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const entries = parseJsonList<EditableTimelineEntry>(value);

  function save(next: EditableTimelineEntry[]) {
    saveJsonList(onChange, next);
  }

  function setEntry(index: number, key: keyof Pick<EditableTimelineEntry, "date" | "title" | "description">, nextValue: string) {
    save(entries.map((entry, i) => i === index ? { ...entry, [key]: nextValue } : entry));
  }

  const INPUT =
    "w-full px-2 py-1 rounded border text-xs bg-[#08050f] text-[#e8dfc8] " +
    "placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors border-[#2a2a35]";
  const LABEL = "block mb-0.5 text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060]";

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="rounded border border-dashed border-[#2a2a35] px-2 py-2 text-[10px] text-[#5a5060]">
          No timeline nodes yet. Add one below to start the bar.
        </p>
      )}
      {entries.map((entry, index) => (
        <div key={index} className="rounded border border-[#2a2a35] bg-[#0f0a1a] p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex-1 text-[10px] font-cinzel tracking-widest uppercase text-[#a89880]">
              Node {index + 1}
            </span>
            <button type="button" onClick={() => save(moveListItem(entries, index, index - 1))} disabled={index === 0}
              className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5">Up</button>
            <button type="button" onClick={() => save(moveListItem(entries, index, index + 1))} disabled={index === entries.length - 1}
              className="text-[11px] text-[#5a5060] hover:text-[#a89880] disabled:opacity-20 px-0.5">Down</button>
            <button type="button" onClick={() => save(entries.filter((_, i) => i !== index))}
              className="text-[11px] text-[#5a5060] hover:text-red-400 px-0.5">Remove</button>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Date / era</label>
              <input value={entry.date ?? ""} onChange={(e) => setEntry(index, "date", e.target.value)}
                placeholder="1227 AF"
                className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Title</label>
              <input value={entry.title ?? ""} onChange={(e) => setEntry(index, "title", e.target.value)}
                placeholder="The Awakening"
                className={INPUT} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea rows={3} value={entry.description ?? ""} onChange={(e) => setEntry(index, "description", e.target.value)}
              placeholder="Short note shown with this timeline node."
              className={`${INPUT} resize-y`} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => save([...entries, { date: "New Date", title: "New Timeline Node", description: "" }])}
        className="w-full rounded border border-[#2a2a35] px-2 py-1.5 text-[10px] font-cinzel tracking-widest uppercase text-[#a89880] transition-colors hover:border-[#8b5cf6] hover:text-[#e8dfc8]">
        Add Timeline Node
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
  quickAdd,
}: {
  value: string;
  onChange: (v: string) => void;
  depth?: number;
  quickAdd?: { type: CardLayoutItemType; nonce: number } | null;
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
      if (type === "media-player") { defaults.title = "Session Recording"; defaults.src = ""; defaults.mediaType = "auto"; defaults.displayMode = "image-button"; defaults.image = "/images/dragon-ears.png"; defaults.caption = ""; }
      if (type === "person") { defaults.name = "New Person"; defaults.role = ""; defaults.img = ""; }
    }
    save([...items, { id, type, props: defaults }]);
    setExpandedId(id);
  }

  useEffect(() => {
    if (!quickAdd) return;
    addItem(quickAdd.type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickAdd]);

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

// ── Card layout visual panel ──────────────────────────────────────────────────

function CardLayoutPanelSection({
  block,
  onPropsChange,
  selectedGridItemId,
  onGridItemSelect,
}: {
  block: BlockItem;
  onPropsChange: (props: Record<string, unknown>) => void;
  selectedGridItemId: string | null;
  onGridItemSelect: (id: string | null) => void;
}) {
  const parsed = parseCardLayoutProps(block.props);
  if (!parsed) return null;
  const { gridRoot, columns, rows, gridItems } = parsed;

  const INPUT =
    "w-full px-2.5 py-1.5 rounded border text-xs bg-[#08050f] text-[#e8dfc8] " +
    "placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] transition-colors border-[#2a2a35]";
  const LABEL = "block mb-1 text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060]";
  const SECTION = "mb-4 pb-4 border-b border-[#1e1828]";

  function updateGridProp(key: string, value: string) {
    onPropsChange(saveCardLayoutItems(block.props, gridRoot, gridItems, { [key]: value }));
  }

  function updateItemProp(itemId: string, key: string, value: unknown) {
    const newItems = gridItems.map((item) =>
      item.id === itemId ? { ...item, props: { ...item.props, [key]: value } } : item
    );
    onPropsChange(saveCardLayoutItems(block.props, gridRoot, newItems));
  }

  function deleteSelectedItem() {
    if (!selectedGridItemId) return;
    const newItems = gridItems.filter((i) => i.id !== selectedGridItemId);
    onPropsChange(saveCardLayoutItems(block.props, gridRoot, newItems));
    onGridItemSelect(null);
  }

  function addItem(type: CardLayoutItemType) {
    const { col, row, needsNewRow } = findFreeCell(gridItems, columns, rows);
    const defaults: Record<string, unknown> = {
      col: String(col), row: String(row), colSpan: "1", rowSpan: "1",
    };
    if (type === "header")     { defaults.title = "New Header"; defaults.size = "md"; }
    if (type === "text")       { defaults.content = "New text block"; }
    if (type === "link")       { defaults.label = "New Link"; defaults.href = ""; defaults.variant = "primary"; }
    if (type === "audio-link") { defaults.label = "Recording"; defaults.href = ""; }
    if (type === "media-player") { defaults.title = "Session Recording"; defaults.src = ""; defaults.mediaType = "auto"; defaults.displayMode = "image-button"; defaults.image = "/images/dragon-ears.png"; defaults.caption = ""; defaults.rowSpan = "2"; }
    if (type === "inner-card") { defaults.items = "[]"; }
    if (type === "image")      { defaults.src = ""; defaults.fit = "cover"; }
    if (type === "person")     { defaults.name = "New Person"; defaults.role = ""; defaults.href = ""; defaults.img = ""; defaults.variant = "portrait"; }
    const newItem: CardLayoutItem = {
      id: `${type}_${Date.now()}`,
      type,
      props: defaults,
    };
    const newItems = [...gridItems, newItem];
    const gridOverrides = needsNewRow ? { rows: String(rows + 1) } : undefined;
    onPropsChange(saveCardLayoutItems(block.props, gridRoot, newItems, gridOverrides));
    onGridItemSelect(newItem.id);
  }

  const selectedItem = selectedGridItemId
    ? gridItems.find((i) => i.id === selectedGridItemId)
    : null;
  const selectedMeta = selectedItem ? GRID_TYPE_META[selectedItem.type] : null;

  return (
    <div className="space-y-0">
      {/* ── Card width ── */}
      <div className={SECTION}>
        <label className={LABEL}>Card Width</label>
        <select
          value={(block.props.width as string) ?? "wide"}
          onChange={(e) => onPropsChange({ ...block.props, width: e.target.value })}
          className={INPUT}
        >
          <option value="wide">Wide</option>
          <option value="campaign">Campaign detail</option>
          <option value="medium">Medium</option>
          <option value="full">Full</option>
        </select>
      </div>

      {/* ── Grid dimensions ── */}
      <div className={SECTION}>
        <p className={LABEL}>Grid Size</p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <p className="text-[9px] text-[#5a5060] mb-1">Columns</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => columns > 1 && updateGridProp("columns", String(columns - 1))}
                className="w-7 h-7 rounded border border-[#2a2a35] text-[#a89880] hover:border-[#8b5cf6] hover:text-[#e8dfc8] text-sm transition-colors">−</button>
              <span className="w-6 text-center text-xs text-[#e8dfc8]">{columns}</span>
              <button type="button" onClick={() => columns < 6 && updateGridProp("columns", String(columns + 1))}
                className="w-7 h-7 rounded border border-[#2a2a35] text-[#a89880] hover:border-[#8b5cf6] hover:text-[#e8dfc8] text-sm transition-colors">+</button>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[9px] text-[#5a5060] mb-1">Rows</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => rows > 1 && updateGridProp("rows", String(rows - 1))}
                className="w-7 h-7 rounded border border-[#2a2a35] text-[#a89880] hover:border-[#8b5cf6] hover:text-[#e8dfc8] text-sm transition-colors">−</button>
              <span className="w-6 text-center text-xs text-[#e8dfc8]">{rows}</span>
              <button type="button" onClick={() => rows < CARD_LAYOUT_MAX_ROWS && updateGridProp("rows", String(rows + 1))}
                className="w-7 h-7 rounded border border-[#2a2a35] text-[#a89880] hover:border-[#8b5cf6] hover:text-[#e8dfc8] text-sm transition-colors">+</button>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[9px] text-[#5a5060] mb-1">Gap</p>
            <select
              value={(gridRoot.props.gap as string) ?? "md"}
              onChange={(e) => updateGridProp("gap", e.target.value)}
              className="w-full px-1.5 py-1.5 rounded border text-xs bg-[#08050f] text-[#e8dfc8] focus:outline-none focus:border-[#8b5cf6] border-[#2a2a35]"
            >
              <option value="sm">Sm</option>
              <option value="md">Md</option>
              <option value="lg">Lg</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Selected item editor ── */}
      {selectedItem && selectedMeta ? (
        <div className={SECTION}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-cinzel tracking-widest uppercase" style={{ color: selectedMeta.color }}>
              {selectedMeta.icon} {selectedMeta.label}
            </p>
            <button type="button" onClick={deleteSelectedItem}
              className="text-[10px] text-[#5a5060] hover:text-[#f87171] transition-colors">
              ✕ Remove
            </button>
          </div>

          {/* Content fields */}
          {selectedItem.type === "header" && (
            <div className="space-y-2">
              <div>
                <label className={LABEL}>Eyebrow</label>
                <input type="text" value={(selectedItem.props.eyebrow as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "eyebrow", e.target.value)}
                  className={INPUT} placeholder="e.g. Test Asset" />
              </div>
              <div>
                <label className={LABEL}>Title</label>
                <input type="text" value={(selectedItem.props.title as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "title", e.target.value)}
                  className={INPUT} placeholder="Header title" />
              </div>
              <div>
                <label className={LABEL}>Size</label>
                <select value={(selectedItem.props.size as string) ?? "md"}
                  onChange={(e) => updateItemProp(selectedItem.id, "size", e.target.value)}
                  className={INPUT}>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Title color</label>
                <select value={(selectedItem.props.color as string) ?? "primary"}
                  onChange={(e) => updateItemProp(selectedItem.id, "color", e.target.value)}
                  className={INPUT}>
                  <option value="primary">Primary</option>
                  <option value="gold">Gold</option>
                </select>
              </div>
            </div>
          )}

          {selectedItem.type === "text" && (
            <div>
              <label className={LABEL}>Text</label>
              <textarea rows={4} value={(selectedItem.props.content as string) ?? ""}
                onChange={(e) => updateItemProp(selectedItem.id, "content", e.target.value)}
                className={`${INPUT} resize-y`} placeholder="Enter text…" />
            </div>
          )}

          {selectedItem.type === "link" && (
            <div className="space-y-2">
              <div>
                <label className={LABEL}>Label</label>
                <input type="text" value={(selectedItem.props.label as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "label", e.target.value)}
                  className={INPUT} placeholder="Link label" />
              </div>
              <div>
                <label className={LABEL}>URL</label>
                <input type="text" value={(selectedItem.props.href as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "href", e.target.value)}
                  className={INPUT} placeholder="https://..." />
              </div>
              <div>
                <label className={LABEL}>Style</label>
                <select value={(selectedItem.props.variant as string) ?? "primary"}
                  onChange={(e) => updateItemProp(selectedItem.id, "variant", e.target.value)}
                  className={INPUT}>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
              </div>
            </div>
          )}

          {selectedItem.type === "audio-link" && (
            <div className="space-y-2">
              <div>
                <label className={LABEL}>Label</label>
                <input type="text" value={(selectedItem.props.label as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "label", e.target.value)}
                  className={INPUT} placeholder="Session recording" />
              </div>
              <div>
                <label className={LABEL}>Recording URL</label>
                <input type="text" value={(selectedItem.props.href as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "href", e.target.value)}
                  className={INPUT} placeholder="https://drive.google.com/..." />
              </div>
            </div>
          )}

          {selectedItem.type === "media-player" && (
            <div className="space-y-2">
              <div>
                <label className={LABEL}>Title</label>
                <input type="text" value={(selectedItem.props.title as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "title", e.target.value)}
                  className={INPUT} placeholder="Session recording" />
              </div>
              <div>
                <label className={LABEL}>Media URL</label>
                <ImagePathField
                  value={(selectedItem.props.src as string) ?? ""}
                  onChange={(v) => updateItemProp(selectedItem.id, "src", v)}
                  placeholder="https://drive.google.com/... or /images/media/file.mp4"
                  accept=".mp3,.wav,.m4a,.ogg,.flac,.mp4,.m4v,.mov,.ogv,.webm"
                  dropLabel="Drop audio or video, or click to upload"
                  previewMedia
                />
              </div>
              <div>
                <label className={LABEL}>Player type</label>
                <select value={(selectedItem.props.mediaType as string) ?? "auto"}
                  onChange={(e) => updateItemProp(selectedItem.id, "mediaType", e.target.value)}
                  className={INPUT}>
                  <option value="auto">Detect automatically</option>
                  <option value="youtube">YouTube video</option>
                  <option value="audio">Audio file</option>
                  <option value="video">Uploaded video</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Display</label>
                <select value={(selectedItem.props.displayMode as string) ?? "full"}
                  onChange={(e) => updateItemProp(selectedItem.id, "displayMode", e.target.value)}
                  className={INPUT}>
                  <option value="full">Full player</option>
                  <option value="image-button">Image button</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Button image</label>
                <ImagePathField
                  value={(selectedItem.props.image as string) ?? "/images/dragon-ears.png"}
                  onChange={(v) => updateItemProp(selectedItem.id, "image", v)}
                />
              </div>
              <div>
                <label className={LABEL}>Caption</label>
                <textarea rows={3} value={(selectedItem.props.caption as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "caption", e.target.value)}
                  className={`${INPUT} resize-y`} />
              </div>
            </div>
          )}

          {selectedItem.type === "image" && (
            <div className="space-y-2">
              <div>
                <label className={LABEL}>Image</label>
                <ImagePathField
                  value={(selectedItem.props.src as string) ?? ""}
                  onChange={(v) => updateItemProp(selectedItem.id, "src", v)}
                />
              </div>
              <div>
                <label className={LABEL}>Alt text</label>
                <input type="text" value={(selectedItem.props.alt as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "alt", e.target.value)}
                  className={INPUT} placeholder="Describe the image" />
              </div>
              <div>
                <label className={LABEL}>Fit</label>
                <select value={(selectedItem.props.fit as string) ?? "cover"}
                  onChange={(e) => updateItemProp(selectedItem.id, "fit", e.target.value)}
                  className={INPUT}>
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                </select>
              </div>
            </div>
          )}

          {selectedItem.type === "divider" && (
            <p className="text-[11px] text-[#5a5060] py-1">No content to edit for a divider.</p>
          )}

          {selectedItem.type === "inner-card" && (
            <div>
              <label className={LABEL}>Inner contents</label>
              <CardLayoutItemsEditor
                value={(selectedItem.props.items as string) ?? "[]"}
                onChange={(v) => updateItemProp(selectedItem.id, "items", v)}
              />
            </div>
          )}

          {selectedItem.type === "person" && (
            <div className="space-y-2">
              <div>
                <label className={LABEL}>Name</label>
                <input type="text" value={(selectedItem.props.name as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "name", e.target.value)}
                  className={INPUT} placeholder="Person's name" />
              </div>
              <div>
                <label className={LABEL}>Role / Title</label>
                <input type="text" value={(selectedItem.props.role as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "role", e.target.value)}
                  className={INPUT} placeholder="e.g. Co-Founder, Guild Master" />
              </div>
              <div>
                <label className={LABEL}>Link URL</label>
                <input type="text" value={(selectedItem.props.href as string) ?? ""}
                  onChange={(e) => updateItemProp(selectedItem.id, "href", e.target.value)}
                  className={INPUT} placeholder="https://..." />
              </div>
              <div>
                <label className={LABEL}>Style</label>
                <select value={(selectedItem.props.variant as string) ?? "portrait"}
                  onChange={(e) => updateItemProp(selectedItem.id, "variant", e.target.value)}
                  className={INPUT}>
                  <option value="portrait">Portrait</option>
                  <option value="tile">Campaign roster tile</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Portrait</label>
                <ImagePathField
                  value={(selectedItem.props.img as string) ?? ""}
                  onChange={(v) => updateItemProp(selectedItem.id, "img", v)}
                />
              </div>
            </div>
          )}

          {/* Span controls */}
          <div className="mt-3 pt-3 border-t border-[#1e1828]">
            <p className="text-[9px] text-[#5a5060] mb-2 font-cinzel tracking-widest uppercase">Size in Grid</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Col span", key: "colSpan", max: columns },
                { label: "Row span", key: "rowSpan", max: rows },
              ].map(({ label, key, max }) => {
                const current = parseInt(String(selectedItem.props[key] ?? "1"), 10) || 1;
                return (
                  <div key={key}>
                    <p className="text-[9px] text-[#5a5060] mb-1">{label}</p>
                    <div className="flex items-center gap-1">
                      <button type="button"
                        onClick={() => current > 1 && updateItemProp(selectedItem.id, key, String(current - 1))}
                        className="w-6 h-6 rounded border border-[#2a2a35] text-[#a89880] hover:border-[#8b5cf6] text-xs transition-colors">−</button>
                      <span className="w-5 text-center text-xs text-[#e8dfc8]">{current}</span>
                      <button type="button"
                        onClick={() => current < max && updateItemProp(selectedItem.id, key, String(current + 1))}
                        className="w-6 h-6 rounded border border-[#2a2a35] text-[#a89880] hover:border-[#8b5cf6] text-xs transition-colors">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className={SECTION}>
          <p className="text-[11px] text-[#5a5060] text-center py-2">
            Click an element in the grid to edit it
          </p>
        </div>
      )}

      {/* ── Add element buttons ── */}
      <div>
        <p className={LABEL}>Add Element</p>
        <div className="grid grid-cols-2 gap-1.5">
          {CARD_LAYOUT_ITEM_TYPES.filter((d) => d.type !== "grid").map((def) => (
            <button
              key={def.type}
              type="button"
              onClick={() => addItem(def.type as CardLayoutItemType)}
              className="flex items-center gap-1.5 rounded border border-[#2a2a35] bg-[#08050f] px-2 py-1.5 text-[10px] text-[#a89880] hover:border-[#8b5cf6] hover:text-[#e8dfc8] transition-colors"
            >
              <span className="w-4 shrink-0 text-center" style={{ color: GRID_TYPE_META[def.type]?.color }}>
                {def.icon}
              </span>
              <span className="truncate font-cinzel tracking-widest uppercase">{def.label}</span>
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
  quickAdd,
}: {
  block: BlockItem;
  onChange: (props: Record<string, unknown>) => void;
  quickAdd?: { type: CardLayoutItemType; nonce: number } | null;
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
        if (block.type === "media-player" && field.key === "src") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              <ImagePathField
                value={val}
                onChange={(next) => set(field.key, next)}
                placeholder={field.placeholder}
                accept=".mp3,.wav,.m4a,.ogg,.flac,.mp4,.m4v,.mov,.ogv,.webm"
                dropLabel="Drop audio or video, or click to upload"
                previewMedia
              />
            </div>
          );
        }
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
              <CardLayoutItemsEditor value={val} onChange={(v) => set(field.key, v)} quickAdd={quickAdd} />
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
        if (field.type === "json" && field.key === "entries" && block.type === "timeline") {
          return (
            <div key={field.key}>
              <label className={LABEL}>{field.label}</label>
              {field.hint && (
                <p className="text-[10px] text-[#5a5060] mb-1">{field.hint}</p>
              )}
              <TimelineEntriesField value={val} onChange={(next) => set(field.key, next)} />
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

function AssetTile({ def, onAdd }: { def: AssetTypeDef; onAdd?: () => void }) {
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
      {onAdd ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="ml-auto shrink-0 rounded border border-[#2a2a35] px-1.5 py-0.5 text-xs text-[#8b5cf6] hover:border-[#8b5cf6]"
          title="Add at the next open canvas position"
        >
          +
        </button>
      ) : (
        <span className="ml-auto text-[#3a3a45] text-xs shrink-0 select-none">⠿</span>
      )}
    </div>
  );
}

// ── Column placement picker ───────────────────────────────────────────────────

function SpanStrip({
  count,
  selectedStart,
  selectedEnd,
  isFullSpan,
  label,
  onSelect,
  onFullSpan,
}: {
  count: number;
  selectedStart: number;
  selectedEnd: number;
  isFullSpan: boolean;
  label: string;
  onSelect: (start: number, end: number) => void;
  onFullSpan: () => void;
}) {
  const [dragStart, setDragStart] = useState<number | null>(null);

  return (
    <div className="space-y-1.5">
      <div
        className="flex gap-1 select-none"
        onMouseLeave={() => setDragStart(null)}
        onMouseUp={() => setDragStart(null)}
      >
        {Array.from({ length: count }, (_, i) => {
          const isSelected = !isFullSpan && i >= selectedStart && i <= selectedEnd;
          return (
            <div
              key={i}
              className={`flex-1 h-8 rounded cursor-pointer flex items-center justify-center transition-colors border ${
                isSelected
                  ? "bg-[#2a1050] border-[#8b5cf6]"
                  : "bg-[#0f0a1a] border-[#2a2a35] hover:border-[#8b5cf6]/60"
              }`}
              onMouseDown={(e) => { e.preventDefault(); setDragStart(i); onSelect(i, i); }}
              onMouseEnter={() => {
                if (dragStart === null) return;
                const from = Math.min(dragStart, i);
                const to = Math.max(dragStart, i);
                onSelect(from, to);
              }}
            >
              <span className={`text-[9px] font-cinzel tracking-widest ${isSelected ? "text-[#a78bfa]" : "text-[#3a3a50]"}`}>
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onFullSpan}
        className={`w-full py-1 rounded border text-[9px] font-cinzel tracking-widest uppercase transition-colors ${
          isFullSpan
            ? "border-[#8b5cf6] bg-[#1a0d30] text-[#a78bfa]"
            : "border-[#2a2a35] text-[#5a5060] hover:border-[#8b5cf6]/60 hover:text-[#a89880]"
        }`}
      >
        {label}
      </button>
    </div>
  );
}

function PlacementPicker({
  columns,
  rows,
  col,
  colSpan,
  row,
  rowSpan,
  onChange,
}: {
  columns: number;
  rows?: number;
  col?: number;
  colSpan?: number;
  row?: number;
  rowSpan?: number;
  onChange: (col?: number, colSpan?: number, row?: number, rowSpan?: number) => void;
}) {
  const colStartIdx = col ? col - 1 : 0;
  const colEndIdx = col ? Math.min(colStartIdx + (colSpan ?? 1) - 1, columns - 1) : columns - 1;

  const rowStartIdx = row ? row - 1 : 0;
  const rowEndIdx = rows && row ? Math.min(rowStartIdx + (rowSpan ?? 1) - 1, rows - 1) : (rows ?? 1) - 1;

  return (
    <div className="space-y-3">
      {/* Column placement */}
      <div>
        <p className="text-[9px] text-[#5a5060] mb-1.5 font-cinzel tracking-widest uppercase">Columns</p>
        <SpanStrip
          count={columns}
          selectedStart={colStartIdx}
          selectedEnd={colEndIdx}
          isFullSpan={!col}
          label="◀▶ Full Width"
          onSelect={(from, to) => onChange(from + 1, to - from + 1, row, rowSpan)}
          onFullSpan={() => onChange(undefined, undefined, row, rowSpan)}
        />
        {col && (
          <p className="mt-1 text-[9px] text-[#5a5060]">
            Col {col}{(colSpan ?? 1) > 1 ? ` · span ${colSpan ?? 1} of ${columns}` : ` of ${columns}`}
          </p>
        )}
      </div>

      {/* Row placement — only shown when rows are defined */}
      {rows && rows > 1 && (
        <div>
          <p className="text-[9px] text-[#5a5060] mb-1.5 font-cinzel tracking-widest uppercase">Rows</p>
          <SpanStrip
            count={rows}
            selectedStart={rowStartIdx}
            selectedEnd={rowEndIdx}
            isFullSpan={!row}
            label="▲▼ Auto"
            onSelect={(from, to) => onChange(col, colSpan, from + 1, to - from + 1)}
            onFullSpan={() => onChange(col, colSpan, undefined, undefined)}
          />
          {row && (
            <p className="mt-1 text-[9px] text-[#5a5060]">
              Row {row}{(rowSpan ?? 1) > 1 ? ` · span ${rowSpan ?? 1} of ${rows}` : ` of ${rows}`}
            </p>
          )}
        </div>
      )}
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
  selectedGridItemId: string | null;
  onGridItemSelect: (id: string | null) => void;
  grid: PageGridMeta | null;
  onGridChange: (grid: PageGridMeta | null) => void;
  onBlockPlacementChange: (id: string, col?: number, colSpan?: number, row?: number, rowSpan?: number) => void;
  canvasMode?: boolean;
  onCanvasAddBlock?: (type: BlockType) => void;
  onSwitchToCanvas?: () => void;
  onSwitchToGrid?: () => void;
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
  selectedGridItemId,
  onGridItemSelect,
  grid,
  onGridChange,
  onBlockPlacementChange,
  canvasMode = false,
  onCanvasAddBlock,
  onSwitchToCanvas,
  onSwitchToGrid,
}: PageEditPanelProps) {
  const [quickAdd, setQuickAdd] = useState<{ type: CardLayoutItemType; nonce: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const editingBlockId = editingBlock?.id;
  const editingCardLayout = editingBlock?.type === "layout-card";
  const categories: { label: string; key: "layout" | "content" }[] = [
    { label: "Layout", key: "layout" },
    { label: "Content", key: "content" },
  ];
  const byCategory = {
    layout: ACTIVE_ASSET_TYPES.filter((a) => a.category === "layout"),
    content: ACTIVE_ASSET_TYPES.filter((a) => a.category === "content"),
  };

  useEffect(() => {
    if (editingBlockId) bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [editingBlockId]);

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
      <div ref={bodyRef} className="flex-1 overflow-y-auto">

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
            {editingBlock.type === "layout-card" ? (
              <CardLayoutPanelSection
                block={editingBlock}
                onPropsChange={onPropsChange}
                selectedGridItemId={selectedGridItemId}
                onGridItemSelect={onGridItemSelect}
              />
            ) : (
              <PropsForm block={editingBlock} onChange={onPropsChange} quickAdd={quickAdd} />
            )}

            {/* ── Page-grid placement (shown when grid is active) ── */}
            {grid && grid.columns > 1 && (
              <div className="mt-4 pt-4 border-t border-[#1e1828]">
                <p className="text-[9px] font-cinzel tracking-widest uppercase text-[#5a5060] mb-2">
                  Grid Placement
                </p>
                <PlacementPicker
                  columns={grid.columns}
                  rows={grid.rows}
                  col={editingBlock.col}
                  colSpan={editingBlock.colSpan}
                  row={editingBlock.row}
                  rowSpan={editingBlock.rowSpan}
                  onChange={(col, colSpan, row, rowSpan) =>
                    onBlockPlacementChange(editingBlock.id, col, colSpan, row, rowSpan)
                  }
                />
              </div>
            )}
          </div>
        )}

        {/* ── Layout mode + Page Grid controls ── */}
        <div className="px-4 py-4 border-b border-[#2a2a35]">
          <p className="text-[10px] font-cinzel tracking-widest uppercase text-[#a89880] mb-2">
            Layout Mode
          </p>

          {/* Grid / Freeform toggle */}
          <div className="flex gap-1 mb-4">
            <button
              type="button"
              onClick={canvasMode ? onSwitchToGrid : undefined}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded border text-[9px] font-cinzel tracking-widest transition-colors ${
                !canvasMode
                  ? "border-[#8b5cf6] bg-[#1a0d30] text-[#a78bfa]"
                  : "border-[#2a2a35] text-[#5a5060] hover:border-[#8b5cf6]/60 hover:text-[#a89880]"
              }`}
            >
              <span>⊞</span> Grid
            </button>
            <button
              type="button"
              onClick={!canvasMode ? onSwitchToCanvas : undefined}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded border text-[9px] font-cinzel tracking-widest transition-colors ${
                canvasMode
                  ? "border-[#8b5cf6] bg-[#1a0d30] text-[#a78bfa]"
                  : "border-[#2a2a35] text-[#5a5060] hover:border-[#8b5cf6]/60 hover:text-[#a89880]"
              }`}
            >
              <span>✦</span> Freeform
            </button>
          </div>

          {/* Columns (only in grid mode) */}
          {!canvasMode && (
          <><p className="text-[9px] font-cinzel tracking-widest uppercase text-[#5a5060] mb-1">Columns</p>
          <div className="flex gap-1 mb-3">
            <button
              type="button"
              onClick={() => onGridChange(null)}
              className={`flex-1 py-2 rounded border text-[9px] font-cinzel tracking-widest transition-colors ${
                !grid || grid.columns <= 1
                  ? "border-[#8b5cf6] bg-[#1a0d30] text-[#a78bfa]"
                  : "border-[#2a2a35] text-[#5a5060] hover:border-[#8b5cf6]/60 hover:text-[#a89880]"
              }`}
            >
              Off
            </button>
            {([2, 3, 4, 5, 6] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onGridChange({ columns: n, rows: grid?.rows, gap: grid?.gap ?? "md" })}
                className={`flex-1 py-2 rounded border text-[9px] font-cinzel tracking-widest transition-colors ${
                  grid?.columns === n
                    ? "border-[#8b5cf6] bg-[#1a0d30] text-[#a78bfa]"
                    : "border-[#2a2a35] text-[#5a5060] hover:border-[#8b5cf6]/60 hover:text-[#a89880]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {grid && grid.columns > 1 && (
            <>
              {/* Rows */}
              <p className="text-[9px] font-cinzel tracking-widest uppercase text-[#5a5060] mb-1">Rows</p>
              <div className="flex gap-1 mb-3">
                <button
                  type="button"
                  onClick={() => onGridChange({ ...grid, rows: undefined })}
                  className={`flex-1 py-1.5 rounded border text-[9px] font-cinzel tracking-widest transition-colors ${
                    !grid.rows
                      ? "border-[#8b5cf6] bg-[#1a0d30] text-[#a78bfa]"
                      : "border-[#2a2a35] text-[#5a5060] hover:border-[#8b5cf6]/60 hover:text-[#a89880]"
                  }`}
                >
                  Auto
                </button>
                {([2, 3, 4, 5, 6] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onGridChange({ ...grid, rows: n })}
                    className={`flex-1 py-1.5 rounded border text-[9px] font-cinzel tracking-widest transition-colors ${
                      grid.rows === n
                        ? "border-[#8b5cf6] bg-[#1a0d30] text-[#a78bfa]"
                        : "border-[#2a2a35] text-[#5a5060] hover:border-[#8b5cf6]/60 hover:text-[#a89880]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Gap */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-cinzel tracking-widest uppercase text-[#5a5060] shrink-0">Gap</span>
                <div className="flex gap-1 flex-1">
                  {(["sm", "md", "lg"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => onGridChange({ ...grid, gap: g })}
                      className={`flex-1 py-1 rounded border text-[9px] font-cinzel tracking-widest transition-colors ${
                        grid.gap === g
                          ? "border-[#8b5cf6] bg-[#1a0d30] text-[#a78bfa]"
                          : "border-[#2a2a35] text-[#5a5060] hover:border-[#8b5cf6]/60"
                      }`}
                    >
                      {g === "sm" ? "Sm" : g === "md" ? "Md" : "Lg"}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {(!grid || grid.columns <= 1) && (
            <p className="text-[10px] text-[#5a5060] mt-1">
              Set columns to divide the page into a grid. Each block can then be placed in specific columns and rows.
            </p>
          )}
          </>)}

          {canvasMode && (
            <p className="text-[10px] text-[#5a5060]">
              Blocks are positioned freely. Drag to move, drag edges to resize.
            </p>
          )}
        </div>

        {/* Asset library */}
        <div className="px-4 py-4">
          <p className="text-[10px] font-cinzel tracking-widest uppercase text-[#a89880] mb-1">
            Add Blocks
          </p>
          <p className="text-[10px] text-[#5a5060] mb-4 leading-relaxed">
            {canvasMode
              ? "Drag a block onto the canvas to place it exactly, or click + for quick placement."
              : "Drag onto the page to insert. Hover any block to see its drag handle and reorder."}
          </p>

          {categories.map(({ label, key }) => (
            <div key={key} className="mb-5">
              <p className="text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060] mb-2">
                {label}
              </p>
              <div className="space-y-1.5">
                {byCategory[key].map((def) => (
                  <AssetTile
                    key={def.type}
                    def={def}
                    onAdd={canvasMode ? () => onCanvasAddBlock?.(def.type as BlockType) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="mb-5">
            <p className="text-[10px] font-cinzel tracking-widest uppercase text-[#5a5060] mb-2">
              Card Layout Internals
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {CARD_LAYOUT_ITEM_TYPES.map((def) => (
                <button
                  key={def.type}
                  type="button"
                  disabled={!editingCardLayout}
                  onClick={() => setQuickAdd({ type: def.type, nonce: Date.now() })}
                  className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                    editingCardLayout
                      ? "border-[#2a2a35] bg-[#08050f] text-[#a89880] hover:border-[#8b5cf6] hover:text-[#e8dfc8]"
                      : "border-[#1b1724] bg-[#08050f] text-[#3a3345] cursor-not-allowed"
                  }`}
                  title={editingCardLayout ? "Add to selected Card Layout block" : "Select a Card Layout block first"}
                >
                  <span className="w-4 shrink-0 text-center text-[#a89880]">{def.icon}</span>
                  <span className="truncate font-cinzel tracking-widest uppercase">{def.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
