"""Join credentials from the production endpoint and wait for agent audio."""

import asyncio
import json
import sys
from pathlib import Path

from livekit import rtc


async def main(credentials_path: Path) -> None:
    credentials = json.loads(credentials_path.read_text(encoding="utf-8"))
    room = rtc.Room()
    agent_joined = asyncio.Event()
    agent_audio = asyncio.Event()
    audible_audio = asyncio.Event()
    audio_tasks: set[asyncio.Task[None]] = set()

    async def inspect_audio(track: rtc.AudioTrack) -> None:
        frames_seen = 0
        async for event in rtc.AudioStream(track):
            frames_seen += 1
            if any(event.frame.data):
                audible_audio.set()
                return
            if frames_seen >= 100:
                return

    @room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            agent_joined.set()

    @room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        del publication
        if (
            participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT
            and track.kind == rtc.TrackKind.KIND_AUDIO
        ):
            agent_audio.set()
            task = asyncio.create_task(inspect_audio(track))
            audio_tasks.add(task)
            task.add_done_callback(audio_tasks.discard)

    await room.connect(
        credentials["serverUrl"],
        credentials["participantToken"],
    )

    for participant in room.remote_participants.values():
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            agent_joined.set()

    await asyncio.wait_for(agent_joined.wait(), timeout=30)
    await asyncio.wait_for(agent_audio.wait(), timeout=30)
    await asyncio.wait_for(audible_audio.wait(), timeout=30)
    print("Dispatched agent joined and published non-silent audio.")
    await room.disconnect()


if __name__ == "__main__":
    asyncio.run(main(Path(sys.argv[1])))
