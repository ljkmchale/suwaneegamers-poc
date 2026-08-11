"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface CharacterIntroductionProps {
  name: string;
  role?: string;
  image: string;
  video?: string;
  audio: string;
  transcript: string;
  campaignName?: string;
}

export function CharacterIntroduction({
  name,
  role,
  image,
  video,
  audio,
  transcript,
  campaignName,
}: CharacterIntroductionProps) {
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const player = videoRef.current ?? audioRef.current;
    player?.play().catch(() => {
      // Browser policy can still require the visitor to press play.
    });

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function close() {
    audioRef.current?.pause();
    videoRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (videoRef.current) videoRef.current.currentTime = 0;
    setOpen(false);
  }

  const overlay = open ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="character-introduction-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="relative max-h-[calc(100dvh-1rem)] w-full max-w-4xl overflow-y-auto rounded-md border shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
        style={{ borderColor: "var(--color-accent-gold)", background: "var(--color-bg-deep)" }}
      >
        <button
          type="button"
          onClick={close}
          aria-label={`Close ${name} introduction`}
          title="Close"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border bg-black/70 text-2xl leading-none transition-colors hover:text-amber-300"
          style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-primary)" }}
        >
          &times;
        </button>

        <div className="relative aspect-video overflow-hidden bg-black">
          {video ? (
            <video
              ref={videoRef}
              src={video}
              poster={image}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <Image
                src={image}
                alt={`${name} portrait`}
                fill
                sizes="(max-width: 896px) 100vw, 896px"
                className="object-cover object-center motion-safe:animate-[character-intro_18s_ease-out_forwards]"
                priority
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-5 pb-5 pt-20 sm:px-8 sm:pb-7">
                <p className="font-cinzel text-xs uppercase tracking-widest" style={{ color: "var(--color-accent-gold)" }}>
                  {campaignName ?? "Campaign"}
                </p>
                <h2 id="character-introduction-title" className="mt-1 font-cinzel text-2xl sm:text-4xl" style={{ color: "var(--color-text-primary)" }}>
                  {name}
                </h2>
                {role && <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>{role}</p>}
              </div>
            </>
          )}
        </div>

        <div className="space-y-4 p-5 sm:p-7">
          {video && (
            <div>
              <p className="font-cinzel text-xs uppercase tracking-widest" style={{ color: "var(--color-accent-gold)" }}>
                {campaignName ?? "Campaign"}
              </p>
              <h2 id="character-introduction-title" className="mt-1 font-cinzel text-2xl sm:text-3xl" style={{ color: "var(--color-text-primary)" }}>
                {name}
              </h2>
              {role && <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>{role}</p>}
            </div>
          )}
          <p className="text-sm leading-7 sm:text-base" style={{ color: "var(--color-text-secondary)" }}>
            &ldquo;{transcript}&rdquo;
          </p>
          {!video && (
            <audio ref={audioRef} controls preload="metadata" src={audio} className="w-full">
              Your browser does not support embedded audio playback.
            </audio>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Meet ${name}`}
        className="group flex w-full min-w-0 items-start gap-3 text-left sm:items-center"
      >
        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 transition-transform group-hover:scale-105 sm:h-16 sm:w-16" style={{ borderColor: "var(--color-accent-gold)" }}>
          <Image src={image} alt="" fill sizes="64px" className="object-cover object-top" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-xl text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
            &#9654;
          </span>
        </span>
        <span className="min-w-0">
          <span className="block font-cinzel" style={{ color: "var(--color-accent-gold)" }}>{name}</span>
          {role && <span className="mt-1 block text-xs" style={{ color: "var(--color-text-muted)" }}>{role}</span>}
          <span className="mt-1 block font-cinzel text-[10px] uppercase tracking-widest transition-colors group-hover:text-amber-300" style={{ color: "var(--color-text-secondary)" }}>
            Meet {name}
          </span>
        </span>
      </button>
      {typeof document !== "undefined" && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
