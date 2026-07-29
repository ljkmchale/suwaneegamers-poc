"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Square, Volume2 } from "lucide-react";

export interface AuditionVoice {
  id: string;
  label: string;
  accent: string;
  /** Personas currently speaking with this voice, for the "in use" badge. */
  usedBy: string[];
  /** Persona whose own lines this voice should audition with, if any. */
  personaId?: string;
  /** The speed that persona uses, so the preview matches the real session. */
  speed: number;
}

const SPEEDS = [
  { value: "persona", label: "As configured" },
  { value: "0.9", label: "0.90× slower" },
  { value: "1", label: "1.00× normal" },
  { value: "1.1", label: "1.10× livelier" },
];

export function VoiceAudition({ voices }: { voices: AuditionVoice[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState("persona");

  // One shared element: clicking a second voice should replace the first, never
  // layer two voices over each other.
  useEffect(() => {
    const audio = new Audio();
    audio.addEventListener("ended", () => setPlaying(null));
    audio.addEventListener("error", () => {
      setPlaying(null);
      setLoading(null);
      setError("That preview could not be played. Is the voice stack running?");
    });
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // Clicking through voices replaces the clip; release the previous blob rather
  // than leaking one per audition.
  function setSource(audio: HTMLAudioElement, url: string) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = url;
    audio.src = url;
  }

  async function play(voice: AuditionVoice) {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing === voice.id) {
      audio.pause();
      setPlaying(null);
      return;
    }

    audio.pause();
    setError(null);
    setLoading(voice.id);

    const params = new URLSearchParams({ voice: voice.id });
    params.set("speed", speed === "persona" ? String(voice.speed) : speed);
    if (voice.personaId) params.set("personaId", voice.personaId);

    try {
      // Fetch first so a failure surfaces as a readable message instead of a
      // silent, broken <audio> element.
      const response = await fetch(`/api/admin/voice-preview?${params}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "The preview could not be generated.");
      }
      setSource(audio, URL.createObjectURL(await response.blob()));
      await audio.play();
      setPlaying(voice.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The preview could not be generated.");
    } finally {
      setLoading(null);
    }
  }

  const groups = [...new Set(voices.map((voice) => voice.accent))];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#6a5a78]">
          <Volume2 size={13} className="text-violet-300" aria-hidden="true" />
          Hear every voice
        </p>
        <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#6a5a78]">
          Speed
          <select
            value={speed}
            onChange={(event) => setSpeed(event.target.value)}
            className="rounded-md border border-[#2a2a35] bg-[#08050f] px-2 py-1 text-xs normal-case tracking-normal text-[#e8dfc8]"
          >
            {SPEEDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-[#7f1d1d] bg-[#1f0a0a] px-3 py-2 text-xs text-[#fca5a5]">
          {error}
        </p>
      ) : null}

      {groups.map((accent) => (
        <div key={accent} className="mb-4 last:mb-0">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-[#5a5060]">{accent}</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {voices
              .filter((voice) => voice.accent === accent)
              .map((voice) => {
                const isPlaying = playing === voice.id;
                const isLoading = loading === voice.id;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => play(voice)}
                    aria-label={`Play a sample of ${voice.label}`}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isPlaying
                        ? "border-violet-400 bg-[#1c1330]"
                        : "border-[#201927] bg-[#08050f] hover:border-[#3a3145]"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1c1330] text-violet-300">
                      {isLoading ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                      ) : isPlaying ? (
                        <Square size={11} aria-hidden="true" />
                      ) : (
                        <Play size={12} aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-[#e8dfc8]">{voice.label}</span>
                      <span className="block truncate text-[10px] text-[#5a5060]">
                        {voice.id}
                        {voice.usedBy.length > 0 ? ` · ${voice.usedBy.join(", ")}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      ))}

      <p className="mt-3 text-[10px] text-[#5a5060]">
        Voices in use audition with their own persona&apos;s lines; the rest read a neutral sample.
      </p>
    </div>
  );
}
