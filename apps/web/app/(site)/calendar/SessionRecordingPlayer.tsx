"use client";

import { useEffect, useRef, useState } from "react";

function drivePreviewUrl(url: string) {
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  return null;
}

function canUseNativeAudio(url: string) {
  return /\.(mp3|m4a|wav|ogg|aac)(?:[?#].*)?$/i.test(url);
}

export function SessionRecordingPlayer({ url }: { url: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const previewUrl = drivePreviewUrl(url);
  const useNativeAudio = !previewUrl && canUseNativeAudio(url);

  function closePlayer() {
    audioRef.current?.pause();
    setOpen(false);
    setBlocked(false);
  }

  async function handleClick() {
    if (open) {
      closePlayer();
      return;
    }

    setOpen(true);
    setBlocked(false);

    if (useNativeAudio) {
      requestAnimationFrame(() => {
        audioRef.current?.play().catch(() => {
          setBlocked(true);
        });
      });
    }
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closePlayer();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePlayer();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={handleClick}
        title={open ? "Close session recording" : "Play session recording"}
        aria-label={open ? "Close session recording" : "Play session recording"}
        aria-expanded={open}
        className="transition-colors hover:opacity-80"
        style={{ color: "var(--color-text-muted)" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M21 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2z" />
          <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 z-20 w-[min(22rem,calc(100vw-4rem))] translate-x-0 rounded-md border p-2 shadow-2xl sm:right-10 sm:top-1/2 sm:-translate-y-1/2"
          style={{
            borderColor: "var(--color-bg-border)",
            background: "linear-gradient(135deg, rgba(15,10,26,.98), rgba(8,5,15,.96))",
          }}
        >
          {previewUrl ? (
            <iframe
              src={previewUrl}
              title="Session recording player"
              allow="autoplay"
              className="h-20 w-full rounded border-0"
            />
          ) : useNativeAudio ? (
            <audio ref={audioRef} src={url} controls preload="none" className="h-9 w-full" />
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded border px-3 py-2 text-xs transition-colors hover:text-amber-400"
              style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-muted)" }}
            >
              Open recording
            </a>
          )}
          {blocked && !previewUrl && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-xs transition-colors hover:text-amber-400"
              style={{ color: "var(--color-text-muted)" }}
            >
              Open recording
            </a>
          )}
        </div>
      )}
    </div>
  );
}
