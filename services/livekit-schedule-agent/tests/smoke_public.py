"""Connect through the production LiveKit hostname using local signing credentials."""

import asyncio
import os
import uuid

from dotenv import load_dotenv
from livekit import api, rtc


async def main() -> None:
    load_dotenv(".env.local")
    api_key = os.environ["LIVEKIT_API_KEY"]
    api_secret = os.environ["LIVEKIT_API_SECRET"]
    room_name = f"public-smoke-{uuid.uuid4()}"
    identity = f"public-smoke-{uuid.uuid4()}"
    token = (
        api.AccessToken(api_key, api_secret)
        .with_identity(identity)
        .with_name("Public connectivity smoke test")
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )

    room = rtc.Room()
    await room.connect("wss://voice.suwaneegamers.net", token)
    print("Public LiveKit signaling and room connection succeeded.")
    await room.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
