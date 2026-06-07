"use client";

import { useState, useRef, useTransition } from "react";
import Image from "next/image";
import { uploadFilesAction, deleteMediaAction } from "./actions";
import type { MediaFile } from "./lib";

interface Props {
  initialFiles: MediaFile[];
  subfolders: string[];
  currentSubfolder: string;
}

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".flac"];
const VIDEO_EXTENSIONS = [".mp4", ".m4v", ".mov", ".ogv", ".webm"];

function hasExtension(filePath: string, extensions: string[]) {
  return extensions.some((ext) => filePath.toLowerCase().endsWith(ext));
}

export function MediaClient({ initialFiles, subfolders, currentSubfolder }: Props) {
  const [files, setFiles] = useState(initialFiles);
  const [subfolder, setSubfolder] = useState(currentSubfolder);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setErrors([]);

    const fd = new FormData();
    fd.set("subfolder", subfolder);
    for (const f of Array.from(fileList)) fd.append("files", f);

    const result = await uploadFilesAction(fd);

    setErrors(result.errors);
    if (result.uploaded.length > 0) {
      // re-fetch file list by reloading from server
      window.location.reload();
    }
    setUploading(false);
  }

  function copyPath(p: string) {
    navigator.clipboard.writeText(p);
    setCopied(p);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleDelete(filePath: string) {
    if (!confirm(`Delete ${filePath}?`)) return;
    const fd = new FormData();
    fd.set("filePath", filePath);
    startTransition(async () => {
      await deleteMediaAction(fd);
      setFiles((prev) => prev.filter((f) => f.path !== filePath));
    });
  }

  return (
    <div className="space-y-8">
      {/* Subfolder selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-cinzel tracking-widest uppercase text-[#a89880]">Folder:</span>
        <button type="button" onClick={() => setSubfolder("")}
          className={`text-xs px-3 py-1 rounded border transition-colors ${!subfolder ? "border-[#8b5cf6] text-[#8b5cf6]" : "border-[#2a2a35] text-[#5a5060] hover:border-[#8b5cf6]"}`}>
          /images/
        </button>
        {subfolders.map((s) => (
          <button key={s} type="button" onClick={() => setSubfolder(s)}
            className={`text-xs px-3 py-1 rounded border transition-colors ${subfolder === s ? "border-[#8b5cf6] text-[#8b5cf6]" : "border-[#2a2a35] text-[#5a5060] hover:border-[#8b5cf6]"}`}>
            {s}/
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-[#8b5cf6] bg-[#1a1025]" : "border-[#2a2a35] hover:border-[#5a5060]"}`}
      >
        <input ref={inputRef} type="file" multiple accept="image/*,audio/*,video/*" className="hidden"
          onChange={(e) => upload(e.target.files)} />
        {uploading ? (
          <p className="text-[#8b5cf6]">Uploading…</p>
        ) : (
          <>
            <p className="text-[#a89880] mb-1">Drag and drop images, audio, or video here</p>
            <p className="text-xs text-[#5a5060]">or click to browse - JPG, PNG, WebP, GIF, SVG, MP3, WAV, M4A, OGG, FLAC, MP4, MOV, WebM</p>
          </>
        )}
      </div>

      {errors.length > 0 && (
        <div className="p-4 rounded border border-red-800 bg-red-950 text-sm text-red-300 space-y-1">
          {errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}

      {/* File grid */}
      <div>
        <p className="text-xs font-cinzel tracking-widest uppercase text-[#5a5060] mb-3">
          {files.length} file{files.length !== 1 ? "s" : ""} in /{subfolder ? `images/${subfolder}` : "images"}/
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {files.map((f) => (
            <div key={f.path} className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] overflow-hidden group">
              <div className="aspect-square relative bg-[#16161e] flex items-center justify-center p-2">
                {hasExtension(f.path, AUDIO_EXTENSIONS) ? (
                  <audio controls preload="metadata" src={f.path} className="w-full" />
                ) : hasExtension(f.path, VIDEO_EXTENSIONS) ? (
                  <video controls preload="metadata" src={f.path} className="max-h-full max-w-full" />
                ) : (
                  <Image src={f.path} alt={f.name} fill className="object-contain p-2" />
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs truncate text-[#a89880] mb-2">{f.name}</p>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => copyPath(f.path)}
                    className="flex-1 text-xs py-1 rounded border border-[#2a2a35] hover:border-[#8b5cf6] text-[#5a5060] hover:text-[#e8dfc8] transition-colors">
                    {copied === f.path ? "Copied!" : "Copy path"}
                  </button>
                  <button type="button" onClick={() => handleDelete(f.path)}
                    className="px-2 text-xs rounded border border-[#2a2a35] hover:border-[#ef4444] text-[#5a5060] hover:text-[#ef4444] transition-colors">
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
