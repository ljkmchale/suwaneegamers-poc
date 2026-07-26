"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useStartAudio,
  useVoiceAssistant,
} from "@livekit/components-react";
import { LoaderCircle, Mic, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ConnectionDetails {
  serverUrl: string;
  participantToken: string;
  voiceSessionId: string;
}

function AssistantRoom({ onDisconnected }: { onDisconnected: () => void }) {
  const { state } = useVoiceAssistant();
  const room = useRoomContext();
  const audioPlayback = useStartAudio({ room, props: {} });
  const stateLabel =
    state === "listening"
      ? "Listening"
      : state === "thinking"
        ? "Checking the calendar"
        : state === "speaking"
          ? "Answering"
          : state === "connecting" || state === "initializing"
            ? "Warming up"
            : "Ready";
  const stateColor =
    state === "listening"
      ? "#4ade80"
      : state === "thinking"
        ? "#f59e0b"
        : state === "speaking"
          ? "#a78bfa"
          : "var(--color-accent-gold)";

  useEffect(() => {
    void room.startAudio().catch(() => {
      // Some browsers require another explicit click after the room connects.
    });
  }, [room]);

  function handleMicrophoneClick() {
    if (!audioPlayback.canPlayAudio) {
      audioPlayback.mergedProps.onClick?.();
      return;
    }
    onDisconnected();
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={handleMicrophoneClick}
          className={`relative flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition hover:scale-105 ${
            state === "listening" || state === "thinking" || state === "speaking"
              ? "animate-pulse"
              : ""
          }`}
          style={{
            borderColor: stateColor,
            background: "rgba(30,18,55,.92)",
            color: stateColor,
            boxShadow: `0 0 18px color-mix(in srgb, ${stateColor} 42%, transparent)`,
          }}
          aria-label={
            audioPlayback.canPlayAudio
              ? `Voice assistant status: ${stateLabel}. Click to end.`
              : "Enable voice assistant audio playback"
          }
          title={
            audioPlayback.canPlayAudio
              ? `${stateLabel} — click to end`
              : "Click to hear the voice assistant"
          }
        >
          {state === "thinking" ? (
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : state === "speaking" ? (
            <Volume2 className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Mic className="h-5 w-5" aria-hidden="true" />
          )}
          <span
            className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border border-slate-950"
            style={{ background: stateColor }}
            aria-hidden="true"
          />
        </button>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow"
          style={{
            borderColor: "rgba(255,255,255,.16)",
            background: "rgba(14,12,28,.92)",
            color: stateColor,
          }}
        >
          {audioPlayback.canPlayAudio ? `${stateLabel} · tap to stop` : "Tap to hear"}
        </span>
      </div>
      <RoomAudioRenderer />
    </>
  );
}

export function ScheduleVoiceAssistant({ configured }: { configured: boolean }) {
  const [connection, setConnection] = useState<ConnectionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function finishConversation() {
    if (connection?.voiceSessionId) {
      void fetch("/api/livekit/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceSessionId: connection.voiceSessionId }),
        keepalive: true,
      });
    }
    setConnection(null);
  }

  useEffect(() => {
    if (!connection?.voiceSessionId) return;
    const finishOnExit = () => {
      navigator.sendBeacon(
        "/api/livekit/session",
        new Blob(
          [JSON.stringify({ voiceSessionId: connection.voiceSessionId })],
          { type: "application/json" },
        ),
      );
    };
    window.addEventListener("pagehide", finishOnExit);
    return () => window.removeEventListener("pagehide", finishOnExit);
  }, [connection]);

  async function startConversation() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as ConnectionDetails & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "The voice assistant is unavailable.");
      }
      setConnection(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The voice assistant is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute right-0 top-0 z-20 flex flex-col items-end gap-2">
      {!connection ? (
        <button
          type="button"
          onClick={startConversation}
          disabled={loading || !configured}
          className="flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            borderColor: "rgba(245,158,11,.55)",
            background: "rgba(30,18,55,.92)",
            color: "var(--color-accent-gold)",
          }}
          aria-label={
            loading
              ? "Connecting to voice assistant"
              : configured
                ? "Ask about the next game by voice"
                : "Voice assistant setup in progress"
          }
          title={
            loading
              ? "Connecting…"
              : configured
                ? "Ask about the next game"
                : "Voice assistant setup in progress"
          }
        >
          <Mic className={`h-5 w-5 ${loading ? "animate-pulse" : ""}`} aria-hidden="true" />
        </button>
      ) : (
        <LiveKitRoom
          token={connection.participantToken}
          serverUrl={connection.serverUrl}
          connect
          audio
          video={false}
          onDisconnected={finishConversation}
          onError={(roomError) => setError(roomError.message)}
          data-lk-theme="default"
        >
          <AssistantRoom onDisconnected={finishConversation} />
        </LiveKitRoom>
      )}

      {error && (
        <p className="max-w-xs text-right text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
