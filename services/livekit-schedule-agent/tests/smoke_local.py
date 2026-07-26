"""Connect to the local website token route and wait for the schedule agent."""

import asyncio

import aiohttp
from livekit import rtc


async def main() -> None:
    async with aiohttp.ClientSession() as http, http.post(
        "http://127.0.0.1:3000/api/livekit/token",
        json={"participantName": "Local smoke test"},
    ) as response:
        response.raise_for_status()
        credentials = await response.json()

    room = rtc.Room()
    agent_joined = asyncio.Event()

    @room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
        if participant.identity.startswith("agent-"):
            agent_joined.set()

    await room.connect(
        credentials["serverUrl"],
        credentials["participantToken"],
    )

    if any(
        participant.identity.startswith("agent-")
        for participant in room.remote_participants.values()
    ):
        agent_joined.set()

    await asyncio.wait_for(agent_joined.wait(), timeout=30)
    print("Local LiveKit schedule agent joined successfully.")
    await room.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
