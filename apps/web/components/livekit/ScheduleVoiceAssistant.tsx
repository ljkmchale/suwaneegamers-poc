"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
  useStartAudio,
  useVoiceAssistant,
} from "@livekit/components-react";
import { createAudioAnalyser, type LocalAudioTrack } from "livekit-client";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

interface ConnectionDetails {
  serverUrl: string;
  participantToken: string;
  voiceSessionId: string;
}

type OrbState = "idle" | "connecting" | "listening" | "thinking" | "speaking";
type WispMotion = {
  left: number;
  top: number;
  rotate: number;
  scale: number;
  duration: number;
  opacity: number;
  blur: number;
};

const orbColors: Record<OrbState, string> = {
  idle: "var(--color-accent-gold)",
  connecting: "var(--color-accent-ice)",
  listening: "#4ade80",
  thinking: "#f59e0b",
  speaking: "#a78bfa",
};

function setOrbListeningLevel(orb: HTMLSpanElement | null, level: number) {
  if (!orb) return;
  orb.style.setProperty("--myra-listening-level", String(level));
  orb.style.setProperty("--myra-listening-inner-glow", `${8 + level * 16}px`);
  orb.style.setProperty("--myra-listening-glow", `${8 + level * 26}px`);
  orb.style.setProperty("--myra-listening-halo", `${18 + level * 34}px`);
  orb.style.setProperty("--myra-listening-brightness", String(0.9 + level * 0.65));
  orb.style.setProperty("--myra-listening-scale", String(0.94 + level * 0.26));
}

function MyraOrb({
  state,
  meterRef,
}: {
  state: OrbState;
  meterRef?: RefObject<HTMLSpanElement | null>;
}) {
  const [wisps, setWisps] = useState<WispMotion[]>([
    { left: 34, top: 28, rotate: -24, scale: 0.78, duration: 2300, opacity: 0.76, blur: 0.3 },
    { left: 67, top: 48, rotate: 38, scale: 0.62, duration: 3100, opacity: 0.66, blur: 0.55 },
    { left: 39, top: 72, rotate: 12, scale: 0.54, duration: 2700, opacity: 0.58, blur: 0.7 },
    { left: 72, top: 70, rotate: -48, scale: 0.44, duration: 3600, opacity: 0.52, blur: 0.85 },
    { left: 24, top: 51, rotate: 64, scale: 0.48, duration: 2900, opacity: 0.6, blur: 0.65 },
  ]);

  useEffect(() => {
    const drifts = new Map<number, number>();
    const moveWisp = (index: number) => {
      const duration = 1700 + Math.random() * 3000;
      setWisps((current) =>
        current.map((wisp, wispIndex) =>
          wispIndex === index
            ? {
                left: 18 + Math.random() * 64,
                top: 17 + Math.random() * 66,
                rotate: wisp.rotate - 110 + Math.random() * 220,
                scale: 0.34 + Math.random() * 0.72,
                duration,
                opacity: 0.44 + Math.random() * 0.38,
                blur: 0.18 + Math.random() * 0.85,
              }
            : wisp,
        ),
      );
      drifts.set(index, window.setTimeout(() => moveWisp(index), duration * (0.72 + Math.random() * 0.4)));
    };
    const start = () => {
      Array.from({ length: 5 }, (_, index) => index).forEach((index) => {
        if (!drifts.has(index)) {
          drifts.set(index, window.setTimeout(() => moveWisp(index), 180 + Math.random() * 1200));
        }
      });
    };
    const stop = () => {
      drifts.forEach((timer) => window.clearTimeout(timer));
      drifts.clear();
    };
    // No point animating a hidden tab — pause the drift to save CPU/battery.
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <span
      ref={meterRef}
      className={`myra-orb myra-orb--${state}`}
      style={
        {
          "--myra-orb-color": orbColors[state],
          "--myra-listening-level": 0,
          "--myra-listening-inner-glow": "8px",
          "--myra-listening-glow": "8px",
          "--myra-listening-halo": "18px",
          "--myra-listening-brightness": 0.9,
          "--myra-listening-scale": 0.94,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {wisps.map((wisp, index) => (
        <span
          key={index}
          className={`myra-orb__wisp myra-orb__wisp--${index + 1}`}
          style={
            {
              "--myra-wisp-left": `${wisp.left}%`,
              "--myra-wisp-top": `${wisp.top}%`,
              "--myra-wisp-rotate": `${wisp.rotate}deg`,
              "--myra-wisp-scale": wisp.scale,
              "--myra-wisp-duration": `${wisp.duration}ms`,
              "--myra-wisp-opacity": wisp.opacity,
              "--myra-wisp-blur": `${wisp.blur}px`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

function AssistantRoom({
  onDisconnected,
  onReady,
}: {
  onDisconnected: () => void;
  onReady: () => void;
}) {
  const { state } = useVoiceAssistant();
  const room = useRoomContext();
  const { microphoneTrack } = useLocalParticipant({ room });
  const orbMeterRef = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  const audioPlayback = useStartAudio({ room, props: {} });
  const handleUiAction = useCallback(
    (message: { payload: Uint8Array }) => {
      try {
        const payload = JSON.parse(new TextDecoder().decode(message.payload)) as {
          action?: unknown;
          href?: unknown;
        };
        if (
          payload.action === "navigate" &&
          typeof payload.href === "string" &&
          payload.href.startsWith("/") &&
          !payload.href.startsWith("//")
        ) {
          router.push(payload.href);
        }
      } catch {
        // Ignore malformed or unsupported data-channel messages.
      }
    },
    [router],
  );
  useDataChannel("myra.ui_action", handleUiAction);

  // Keep Myra pointed at whatever the visitor is looking at. Fires on connect
  // and on every navigation — including the ones Myra performs herself via
  // open_site_page, so "tell me more about this" works right after she opens
  // something. Best effort: if the publish fails, she still has the page that
  // rode in with the connection token.
  const pathname = usePathname();
  useEffect(() => {
    const participant = room?.localParticipant;
    if (!participant) return;
    const payload = JSON.stringify({ path: pathname, title: document.title });
    void participant
      .publishData(new TextEncoder().encode(payload), {
        reliable: true,
        topic: "myra.page_context",
      })
      .catch(() => {
        // Non-fatal: page context is an enhancement, not required for a turn.
      });
  }, [room, pathname]);
  const stateLabel =
    state === "listening"
      ? "Listening"
      : state === "thinking"
        ? "Thinking..."
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

  useEffect(() => {
    if (state === "listening" || state === "thinking" || state === "speaking") {
      onReady();
    }
  }, [onReady, state]);

  useEffect(() => {
    const track = microphoneTrack?.track as LocalAudioTrack | undefined;
    if (state !== "listening" || !track?.mediaStream) {
      setOrbListeningLevel(orbMeterRef.current, 0);
      return;
    }

    const { analyser, cleanup } = createAudioAnalyser(track, {
      fftSize: 256,
      smoothingTimeConstant: 0,
    });
    const samples = new Float32Array(analyser.fftSize);
    let noiseFloor = 0.008;
    let envelope = 0;
    let animationFrame = 0;

    const updateMeter = () => {
      analyser.getFloatTimeDomainData(samples);
      let sumSquares = 0;
      for (const sample of samples) sumSquares += sample * sample;
      const rms = Math.sqrt(sumSquares / samples.length);

      // Learn steady room noise slowly without letting speech raise the floor.
      if (rms < noiseFloor * 2.2) {
        noiseFloor = noiseFloor * 0.985 + rms * 0.015;
      }
      const voice = Math.max(0, rms - noiseFloor * 1.35);
      const target = Math.min(1, Math.pow(voice * 18, 0.72));
      const response = target > envelope ? 0.58 : 0.2;
      envelope += (target - envelope) * response;
      if (envelope < 0.015) envelope = 0;

      setOrbListeningLevel(orbMeterRef.current, envelope);
      animationFrame = window.requestAnimationFrame(updateMeter);
    };

    animationFrame = window.requestAnimationFrame(updateMeter);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      cleanup();
      setOrbListeningLevel(orbMeterRef.current, 0);
    };
  }, [microphoneTrack?.track, state]);

  function handleMicrophoneClick() {
    if (!audioPlayback.canPlayAudio) {
      audioPlayback.mergedProps.onClick?.();
      return;
    }
    onDisconnected();
  }

  return (
    <>
      <div className="flex w-40 flex-col items-center gap-1.5">
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow"
          style={{
            borderColor: "rgba(255,255,255,.16)",
            background: "rgba(14,12,28,.92)",
            color: stateColor,
          }}
        >
          Myra
        </span>
        <button
          type="button"
          onClick={handleMicrophoneClick}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-transparent"
          aria-label={
            audioPlayback.canPlayAudio
              ? `Myra status: ${stateLabel}. Click to end.`
              : "Enable Myra's audio playback"
          }
          title={
            audioPlayback.canPlayAudio
              ? `${stateLabel} — click to end`
              : "Click to hear Myra"
          }
        >
          <MyraOrb
            state={
              state === "listening" || state === "thinking" || state === "speaking"
                ? state
                : "connecting"
            }
            meterRef={orbMeterRef}
          />
        </button>
        <span
          className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow"
          style={{
            borderColor: "rgba(255,255,255,.16)",
            background: "rgba(14,12,28,.92)",
            color: stateColor,
          }}
        >
          {audioPlayback.canPlayAudio
            ? state === "listening"
              ? "Tap to stop"
              : `${stateLabel} · tap to stop`
            : "Tap to hear"}
        </span>
      </div>
      <RoomAudioRenderer />
    </>
  );
}

export function ScheduleVoiceAssistant({
  configured,
  enabled,
  isNewVisitor,
}: {
  configured: boolean;
  enabled: boolean;
  isNewVisitor: boolean;
}) {
  const pathname = usePathname();
  const hiddenOnCurrentPage =
    pathname === "/maps-of-myrdae" ||
    pathname === "/store" ||
    pathname.startsWith("/store/");
  const welcomeKindRef = useRef<"new" | "returning" | "none">("none");
  const [connection, setConnection] = useState<ConnectionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (window.sessionStorage.getItem("sg-myra-welcomed")) return;
    welcomeKindRef.current = isNewVisitor ? "new" : "returning";
  }, [isNewVisitor]);

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

  async function handleRoomError(roomError: Error) {
    if (
      roomError.name === "NotAllowedError" ||
      /permission|not allowed by the user agent|not allowed by the platform/i.test(roomError.message)
    ) {
      setError("Myra needs microphone permission. Tap Myra again and choose Allow.");
      return;
    }
    if (
      roomError.message.toLowerCase().includes("requested device not found") &&
      navigator.mediaDevices?.enumerateDevices
    ) {
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (devices.some((device) => device.kind === "audioinput")) {
        return;
      }
    }
    setError(roomError.message);
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

  if (!enabled || hiddenOnCurrentPage) {
    return null;
  }

  async function startConversation() {
    setLoading(true);
    setError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not provide microphone access for Myra.");
      }
      // Ask while this function is running from the visitor's tap. New mobile
      // and external browsers reject an automatic page-load microphone request,
      // even when the same browser was previously allowed on the home network.
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());

      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          welcomeKind: welcomeKindRef.current,
          // The page they were on when they tapped the mic, so the very first
          // question can be about it. Navigation after this point is sent over
          // the myra.page_context data channel instead.
          page: { path: pathname, title: document.title },
        }),
      });
      const payload = (await response.json()) as ConnectionDetails & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Myra is unavailable.");
      }
      window.sessionStorage.setItem("sg-myra-welcomed", "1");
      setConnection(payload);
    } catch (caught) {
      if (
        caught instanceof DOMException &&
        (caught.name === "NotAllowedError" || caught.name === "SecurityError")
      ) {
        setError("Myra needs microphone permission. Tap Myra again and choose Allow.");
      } else {
        setError(caught instanceof Error ? caught.message : "Myra is unavailable.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed right-1 top-20 z-50 flex flex-col items-end gap-2 sm:right-2">
      {!connection ? (
        <div className="flex w-40 flex-col items-center gap-1.5">
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow"
            style={{
              borderColor: "rgba(255,255,255,.16)",
              background: "rgba(14,12,28,.92)",
              color: "var(--color-accent-gold)",
            }}
          >
            Myra
          </span>
          <button
            type="button"
            onClick={() => void startConversation()}
            disabled={loading || !configured}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={
              loading
                ? "Connecting to Myra"
                : configured
                  ? "Ask Myra a question"
                  : "Myra setup in progress"
            }
            title={
              loading
                ? "Connecting…"
                : configured
                  ? "Talk with Myra"
                  : "Myra setup in progress"
            }
          >
            <MyraOrb state={loading ? "connecting" : "idle"} />
          </button>
          <span
            className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow"
            style={{
              borderColor: "rgba(255,255,255,.16)",
              background: "rgba(14,12,28,.92)",
              color: loading ? orbColors.connecting : "var(--color-accent-gold)",
            }}
          >
            {loading ? "Connecting…" : configured ? "Tap to speak" : "Setup in progress"}
          </span>
        </div>
      ) : (
        <LiveKitRoom
          token={connection.participantToken}
          serverUrl={connection.serverUrl}
          connect
          audio={{
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            voiceIsolation: true,
          }}
          video={false}
          onDisconnected={finishConversation}
          onError={(roomError) => void handleRoomError(roomError)}
          data-lk-theme="default"
        >
          <AssistantRoom
            onDisconnected={finishConversation}
            onReady={() => setError(null)}
          />
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
