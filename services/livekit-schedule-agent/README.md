# Suwanee Gamers LiveKit Schedule Agent

This Python service is the fully local realtime voice backend for the assistant
displayed on the Suwanee Gamers homepage. LiveKit handles microphone audio,
turn-taking, interruptions, and room dispatch. Ollama provides the language
model, while the local Speaches server provides speech recognition and speech
generation.

The Next.js token endpoint places a current public-calendar snapshot in the
LiveKit agent dispatch metadata. The agent's `get_upcoming_games` tool uses that
snapshot as its only schedule source.

The same dispatch metadata also carries a `knowledge` field: the contents of
`content/assistant-brain.md`, a curated knowledge base about the group, its
campaigns, Dungeon Masters, and links (see `scripts/build-assistant-brain.mjs`).
Schedule questions are answered deterministically for speed; other questions are
answered by the language model grounded on that knowledge base.

## Local services

The default development configuration expects:

- LiveKit Server: `ws://127.0.0.1:7880`
- Ollama: `http://127.0.0.1:11434`
- Speaches: `http://127.0.0.1:8000`

Copy `.env.example` to `.env.local` if it is not already present. Then:

1. Install dependencies:

   `uv sync --directory services/livekit-schedule-agent`

2. Download the LiveKit model files:

   `uv run --directory services/livekit-schedule-agent python -m schedule_agent.agent download-files`

3. Run the agent:

   `uv run --directory services/livekit-schedule-agent python -m schedule_agent.agent dev`

The agent dispatch name must remain `suwanee-schedule-assistant`, matching the
website token route.
