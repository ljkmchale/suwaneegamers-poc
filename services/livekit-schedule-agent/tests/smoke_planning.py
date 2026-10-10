"""Speak synthetic local audio into a production-dispatched Myra room.

Obtain credentials with apps/web/scripts/smoke-livekit-auth.mjs and
LIVEKIT_SMOKE_OUTPUT pointing to a private temporary file. Pass that path here.
Uses local Kokoro for test input, real STT/worker/TTS, and checks real analytics.
Never prints credentials or authenticated dispatch metadata.
"""

import asyncio
import base64
import json
import os
import sqlite3
import sys
import time
import urllib.request
from pathlib import Path

from livekit import rtc

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from schedule_agent.agent import map_campaign_to_brain, parse_dispatch_metadata


def synthesize(question):
    request = urllib.request.Request(
        "http://127.0.0.1:8000/v1/audio/speech",
        data=json.dumps(
            {
                "model": os.getenv("LOCAL_TTS_MODEL", "speaches-ai/Kokoro-82M-v1.0-ONNX"),
                "voice": "af_heart",
                "input": question,
                "response_format": "pcm",
            }
        ).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


async def main(path, scheduled_only=False, freshness=False, participants=False, ana=False,
               conversation=False):
    credentials = json.loads(path.read_text())
    claim = credentials["participantToken"].split(".")[1]
    claims = json.loads(base64.urlsafe_b64decode(claim + "=" * (-len(claim) % 4)))
    metadata = parse_dispatch_metadata(claims["roomConfig"]["agents"][0]["metadata"])
    # Short recap keeps an actual spoken-response test bounded.
    recap = min(metadata["recaps"], key=lambda item: len(item["summary"]))
    name = recap["name"]
    cases = [
        ("What happened last session?", "Which campaign", "recap_clarify"),
        (f"What happened last time in {name} and when do we play again?", "game", "recap"),
        (f"What happened last time in {name}, who was involved, and when do we play again?", "game", "recap"),
    ]
    if scheduled_only:
        candidates = [item for item in metadata["recaps"] if any(
            (map_campaign_to_brain(event["title"]) or event["title"]) ==
            (map_campaign_to_brain(item["name"]) or item["name"])
            for event in metadata["events"])]
        recap = min(candidates, key=lambda item: len(item["summary"]))
        name = recap["name"]
        cases = [(f"What happened last time in {name} and when do we play again?",
                  f"next {name} game", "recap")]
    if freshness:
        name = "Souls of Destiny"
        cases = [(f"What happened last time in {name} and what time are we playing next?",
                  "next", "recap")]
    if participants:
        name = "Souls of Destiny"
        cases = [(f"Who was involved last session in {name}?", "Escanor", "recap")]
    if ana:
        name = "A New Adventure"
        cases = [(f"What happened last time in {name}, who was involved, and when do we play again?",
                  "game", "recap")]
    if conversation:
        cases = [
            ("What happened last session and when do we play again?", "Which campaign", "recap_clarify"),
            ("Souls of Destiny, please.", "Souls of Destiny", "recap"),
            ("And who was involved?", "Escanor", "recap"),
            ("No, I meant A New Adventure.", "Ridley", "recap"),
        ]
    audio = [await asyncio.to_thread(synthesize, item[0]) for item in cases]
    room = rtc.Room()
    transcripts = []
    non_silent = [0]
    timing = {"started": None, "first_audio": None, "first_transcript": None}
    tasks = set()

    async def inspect(track):
        async for event in rtc.AudioStream(track):
            if any(abs(sample) > 300 for sample in event.frame.data):
                non_silent[0] += 1
                if timing["started"] is not None and timing["first_audio"] is None:
                    timing["first_audio"] = time.monotonic()

    @room.on("track_subscribed")
    def on_track(track, publication, participant):
        if (
            participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT
            and track.kind == rtc.TrackKind.KIND_AUDIO
        ):
            task = asyncio.create_task(inspect(track))
            tasks.add(task)
            task.add_done_callback(tasks.discard)

    @room.on("transcription_received")
    def on_transcription(segments, participant, publication):
        if participant and participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            for segment in segments:
                if segment.final:
                    transcripts.append(segment.text)
                    if timing["started"] is not None and timing["first_transcript"] is None:
                        timing["first_transcript"] = time.monotonic()

    await room.connect(credentials["serverUrl"], credentials["participantToken"])
    source = rtc.AudioSource(24000, 1)
    track = rtc.LocalAudioTrack.create_audio_track("planner-smoke-input", source)
    await room.local_participant.publish_track(
        track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
    )
    db_path = Path(__file__).resolve().parents[3] / "content" / "suwaneegamers.db"
    db = sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    try:
        # Allow the worker greeting to finish before speaking.
        await asyncio.sleep(14)
        for (question, expected, category), pcm in zip(cases, audio, strict=True):
            before = len(transcripts)
            before_audio = non_silent[0]
            before_id = db.execute("SELECT COALESCE(MAX(id), 0) FROM voice_questions WHERE session_id=?",
                                   (metadata["voiceSessionId"],)).fetchone()[0]
            started = time.monotonic()
            timing.update(started=started, first_audio=None, first_transcript=None)
            # 20 ms mono signed-16-bit PCM frames, plus endpointing silence.
            data = pcm + bytes(24000 * 2 * 2)
            for offset in range(0, len(data), 960):
                chunk = data[offset : offset + 960].ljust(960, b"\0")
                await source.capture_frame(rtc.AudioFrame(chunk, 24000, 1, 480))
            await source.wait_for_playout()
            input_finished = time.monotonic()
            timing.update(first_audio=None, first_transcript=None)
            deadline = time.monotonic() + 90
            row = None
            while time.monotonic() < deadline:
                row = db.execute(
                    "SELECT question, answer, category, response_ms FROM voice_questions WHERE session_id=? AND id>? ORDER BY id DESC LIMIT 1",
                    (metadata["voiceSessionId"], before_id),
                ).fetchone()
                spoken = " ".join(transcripts[before:])
                if (
                    row
                    and row["category"] == category
                    and expected.casefold() in spoken.casefold()
                    and non_silent[0] > before_audio
                ):
                    break
                await asyncio.sleep(0.5)
            else:
                raise AssertionError(
                    f"Live case failed: {question}; analytics={dict(row) if row else None}; spoken={transcripts[before:]}"
                )
            if category == "recap" and not participants and not conversation:
                assert name.casefold() in row["answer"].casefold(), "Wrong campaign"
                assert "next" in spoken.casefold() or "upcoming" in spoken.casefold(), (
                    "Schedule portion missing"
                )
                if freshness:
                    assert "session 15" in row["answer"].casefold(), "Stale session"
                    assert "couldn't verify" not in row["answer"].casefold(), "Fresh recap unavailable"
                if ana:
                    assert "session 35" in row["answer"].casefold(), "Stale ANA session"
                    assert "ridley" in row["answer"].casefold(), "ANA participants missing"
                    assert "couldn't verify" not in row["answer"].casefold(), "ANA retrieval unavailable"
            if conversation and question == "Souls of Destiny, please.":
                assert "next Souls of Destiny game" in row["answer"], "Clarification lost schedule"
            if conversation and question == "And who was involved?":
                assert "here's what happened" not in row["answer"].casefold(), "Follow-up repeated recap"
            if conversation and question.startswith("No, I meant"):
                assert "Escanor" not in row["answer"], "Correction retained prior campaign"
            print(
                json.dumps(
                    {
                        "question": question,
                        "recognized": row["question"],
                        "category": row["category"],
                        "handler_ms": row["response_ms"],
                        "spoken": spoken,
                        "non_silent_frames": non_silent[0] - before_audio,
                        "elapsed_seconds": round(time.monotonic() - started, 2),
                        "input_seconds": round(input_finished - started, 2),
                        "first_audio_after_input_seconds": round(timing["first_audio"] - input_finished, 2)
                        if timing["first_audio"] is not None else None,
                        "first_transcript_after_input_seconds": round(timing["first_transcript"] - input_finished, 2)
                        if timing["first_transcript"] is not None else None,
                    }
                ),
                flush=True,
            )
            await asyncio.sleep(2)
        print(
            "PASS: production token, dispatched planner, real STT, non-silent TTS, and analytics.",
            flush=True,
        )
    finally:
        db.close()
        await room.disconnect()
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


if __name__ == "__main__":
    asyncio.run(main(Path(sys.argv[1]), scheduled_only="--scheduled" in sys.argv[2:],
                     freshness="--freshness" in sys.argv[2:],
                     participants="--participants" in sys.argv[2:],
                     ana="--ana" in sys.argv[2:],
                     conversation="--conversation" in sys.argv[2:]))
