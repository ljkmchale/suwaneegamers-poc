"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useStartAudio,
  useVoiceAssistant,
} from "@livekit/components-react";
import { useEffect, useState } from "react";
import styles from "./myra-avatar-poc.module.css";

interface ConnectionDetails {
  serverUrl: string;
  participantToken: string;
  voiceSessionId: string;
}

function IdleAvatar({ hidden = false }: { hidden?: boolean }) {
  return (
    <video
      className={`${styles.idleVideo} ${hidden ? styles.idleVideoHidden : ""}`}
      src="/media/images/poc/myra-avatar-idle-v2.mp4"
      poster="/media/images/poc/myra-avatar-poc-v6.png"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-label="Myra waiting to begin a conversation"
    />
  );
}

function AvatarRoom({ onEnd }: { onEnd: () => void }) {
  const { state, videoTrack } = useVoiceAssistant();
  const audioPlayback = useStartAudio({ props: {} });
  const [liveVideoReady, setLiveVideoReady] = useState(false);

  useEffect(() => {
    setLiveVideoReady(false);
  }, [videoTrack]);

  useEffect(() => {
    if (state !== "listening") return;
    const idleTimer = window.setTimeout(onEnd, 60_000);
    return () => window.clearTimeout(idleTimer);
  }, [onEnd, state]);

  const stateLabel =
    state === "listening"
      ? "Myra is listening"
      : state === "thinking"
        ? "Consulting the chronicles…"
        : state === "speaking"
          ? "Myra is speaking"
          : "Myra is arriving…";

  return (
    <>
      <div className={styles.stage} data-state={state}>
        <div className={styles.portraitWrap}>
          <IdleAvatar hidden={liveVideoReady} />
          {videoTrack && (
            <VideoTrack
              trackRef={videoTrack}
              className={`${styles.avatarVideo} ${liveVideoReady ? styles.avatarVideoReady : ""}`}
              onCanPlay={() => setLiveVideoReady(true)}
            />
          )}
        </div>
        <div className={styles.status} aria-live="polite">
          <span className={styles.statusDot} aria-hidden="true" />
          <span>{stateLabel}</span>
        </div>
      </div>

      <div className={styles.controls}>
        {!audioPlayback.canPlayAudio && (
          <button type="button" onClick={audioPlayback.mergedProps.onClick}>
            Enable audio
          </button>
        )}
        <button type="button" onClick={onEnd}>End conversation</button>
      </div>
      <RoomAudioRenderer />
    </>
  );
}

export function MyraAvatarPoc() {
  const [connection, setConnection] = useState<ConnectionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connection?.voiceSessionId) return;
    const finishOnExit = () => {
      navigator.sendBeacon(
        "/api/livekit/session",
        new Blob([JSON.stringify({ voiceSessionId: connection.voiceSessionId })], {
          type: "application/json",
        }),
      );
    };
    window.addEventListener("pagehide", finishOnExit);
    return () => window.removeEventListener("pagehide", finishOnExit);
  }, [connection]);

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

  async function startConversation() {
    setLoading(true);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not provide microphone access.");
      }
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());

      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarPoc: true,
          welcomeKind: "none",
          page: { path: "/myra-avatar-poc", title: document.title },
        }),
      });
      const payload = (await response.json()) as ConnectionDetails & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The avatar POC is unavailable.");
      setConnection(payload);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "NotAllowedError") {
        setError("Microphone permission is required to speak with Myra.");
      } else {
        setError(caught instanceof Error ? caught.message : "The avatar POC is unavailable.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <section className={styles.shell} aria-labelledby="poc-title">
        <header className={styles.header}>
          <p className={styles.eyebrow}>Isolated LemonSlice prototype</p>
          <h1 id="poc-title">Myra, the Living Guide</h1>
          <p>
            A private proof of concept using Myra&apos;s existing voice and intelligence
            with a real-time LemonSlice avatar.
          </p>
        </header>

        {connection ? (
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
            onError={(roomError) => setError(roomError.message)}
          >
            <AvatarRoom onEnd={finishConversation} />
          </LiveKitRoom>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.stage} ${styles.stageButton}`}
              data-state={loading ? "connecting" : "idle"}
              onClick={() => void startConversation()}
              disabled={loading}
              aria-label={loading ? "Preparing Myra" : "Tap to talk with Myra"}
            >
              <div className={styles.portraitWrap}>
                <IdleAvatar />
              </div>
              <div className={styles.status}>
                <span className={styles.statusDot} aria-hidden="true" />
                <span>{loading ? "Preparing Myra…" : "Tap to talk with Myra"}</span>
              </div>
            </button>
          </>
        )}

        {error && <p className={styles.error} role="alert">{error}</p>}

        <aside className={styles.safetyNote}>
          <strong>POC boundary:</strong> unlinked route and separately named worker;
          the production Myra widget is not changed or restarted.
        </aside>
      </section>
    </main>
  );
}
