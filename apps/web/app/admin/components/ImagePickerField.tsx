"use client";

import { useState, useRef, useTransition, DragEvent, ChangeEvent } from "react";
import { uploadFilesAction } from "../media/actions";

interface Props {
  name: string;
  label: string;
  subfolder: string;
  defaultValue?: string;
}

export function ImagePickerField({ name, label, subfolder, defaultValue = "" }: Props) {
  const [path, setPath] = useState(defaultValue);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    const fd = new FormData();
    fd.append("subfolder", subfolder);
    for (const f of Array.from(files)) fd.append("files", f);

    startTransition(async () => {
      const result = await uploadFilesAction(fd);
      if (result.uploaded.length > 0) {
        setPath(result.uploaded[0]);
      }
      if (result.errors.length > 0) {
        setError(result.errors.join(", "));
      }
    });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    upload(e.target.files);
  }

  const ZONE_BASE = "relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors";
  const ZONE_IDLE = "border-[#2a2a35] hover:border-[#8b5cf6]";
  const ZONE_DRAG = "border-[#8b5cf6] bg-[#1a1025]";
  const ZONE_BUSY = "border-[#2a2a35] opacity-60 cursor-wait";

  return (
    <div className="space-y-3">
      <p className="block text-xs font-cinzel tracking-widest uppercase text-[#a89880]">{label}</p>

      {/* Hidden input carries the path value into the parent form */}
      <input type="hidden" name={name} value={path} />

      {/* Current preview */}
      {path && (
        <div className="flex items-center gap-3 p-3 rounded border border-[#2a2a35] bg-[#16161e]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={path} alt="" className="w-16 h-16 object-cover rounded" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#e8dfc8] truncate font-mono">{path}</p>
          </div>
          <button
            type="button"
            onClick={() => setPath("")}
            className="text-xs text-[#5a5060] hover:text-[#ef4444] shrink-0"
          >
            Remove
          </button>
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`${ZONE_BASE} ${isPending ? ZONE_BUSY : dragging ? ZONE_DRAG : ZONE_IDLE}`}
        onClick={() => !isPending && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!isPending) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.avif"
          className="sr-only"
          onChange={onChange}
        />
        {isPending ? (
          <p className="text-sm text-[#a89880]">Uploading…</p>
        ) : (
          <>
            <p className="text-sm text-[#a89880]">
              {path ? "Replace image" : "Drop image here or click to browse"}
            </p>
            <p className="text-xs text-[#5a5060] mt-1">jpg, png, webp, gif, svg, avif</p>
          </>
        )}
      </div>

      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  );
}
