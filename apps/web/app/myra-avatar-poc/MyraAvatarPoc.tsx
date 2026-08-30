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

function AvatarRoom({ onEnd }: { onEnd: () => void }) {
  const { state, videoTrack } = useVoiceAssistant();
  const audioPlayback = useStartAudio({ props: {} });
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
        <div className={styles.ring} aria-hidden="true" />
        <div className={styles.portraitWrap}>
          {videoTrack ? (
            <VideoTrack trackRef={videoTrack} className={styles.avatarVideo} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.portrait}
              src="/media/images/poc/myra-avatar-poc-v1.png"
              alt="Myra, an ethereal violet and gold guide"
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
            <div className={styles.stage} data-state="idle">
              <div className={styles.ring} aria-hidden="true" />
              <div className={styles.portraitWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.portrait}
                  src="/media/images/poc/myra-avatar-poc-v1.png"
                  alt="Myra, an ethereal violet and gold guide"
                />
              </div>
              <div className={styles.status}>
                <span className={styles.statusDot} aria-hidden="true" />
                <span>Ready for the avatar test</span>
              </div>
            </div>
            <div className={styles.controls}>
              <button type="button" onClick={() => void startConversation()} disabled={loading}>
                {loading ? "Calling Myra…" : "Start avatar conversation"}
              </button>
            </div>
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
