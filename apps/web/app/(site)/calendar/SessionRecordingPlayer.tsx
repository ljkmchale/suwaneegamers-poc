"use client";

import { useEffect, useRef, useState } from "react";
import { recordUsageEvent } from "@/components/analytics/AnalyticsTracker";

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

export function SessionRecordingPlayer({
  url,
  label = "Session recording",
  controlLabel = "session recording",
  contentType = "session recording",
}: {
  url: string;
  label?: string;
  controlLabel?: string;
  contentType?: string;
}) {
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
    // Native audio emits a real "play" event that the site-wide tracker captures.
    // Drive embeds do not expose playback events across the iframe boundary.
    if (!useNativeAudio) {
      recordUsageEvent({
        eventType: "media_play",
        contentType,
        contentId: url,
        contentLabel: label,
      });
    }

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
        data-media-control="true"
        onClick={handleClick}
        title={open ? `Close ${controlLabel}` : `Play ${controlLabel}`}
        aria-label={open ? `Close ${controlLabel}` : `Play ${controlLabel}`}
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border transition-colors hover:opacity-80"
        style={{
          borderColor: "var(--color-bg-border)",
          background: "rgba(255, 255, 255, 0.06)",
        }}
      >
        <img
          src="/media/images/dragon-ears.webp"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
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
            <audio
              ref={audioRef}
              src={url}
              controls
              preload="none"
              data-analytics-label={label}
              className="h-9 w-full"
            />
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
