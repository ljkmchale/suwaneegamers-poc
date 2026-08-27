# Suwanee Gamers LiveKit Schedule Agent

This Python service is the fully local realtime voice backend for Myra,
the Suwanee Gamers assistant displayed on the Suwanee Gamers homepage.
LiveKit handles microphone audio,
turn-taking, interruptions, and room dispatch. Claude Haiku (Anthropic API)
provides the language model, while the local Speaches server provides speech
recognition and speech generation.

The Next.js token endpoint places a current public-calendar snapshot in the
LiveKit agent dispatch metadata. The agent's `get_upcoming_games` tool uses that
snapshot as its only schedule source.

The same dispatch metadata also carries a `knowledge` field: the contents of
`content/assistant-brain.md`, a curated knowledge base about the group, its
campaigns, Dungeon Masters, and links (see `scripts/build-assistant-brain.mjs`).
Schedule questions are answered deterministically for speed; other questions are
answered by the language model grounded on that knowledge base.

## Response timing & auto-tuning

Timing knobs (endpointing delay, VAD silence, interruption guard) come from
`content/assistant-tuning.json`, shipped to the agent in dispatch metadata
as `tuning` (env vars remain manual overrides). The worker warms Claude and the
TTS voice per job process (`_warm_claude` / `_warm_tts` in `prewarm`) so visitors
never pay cold-start latency. It logs real per-turn metrics via a `metrics_collected`
listener, forwarding TTFT / end-of-utterance / TTS-TTFB / interruption records to
`POST /api/livekit/metrics`.

The nightly `assistant-autotune` scheduler job
(`apps/web/scripts/autotune-assistant.ts`) reads those metrics and nudges the
endpointing delay and interruption guard within safe bounds — interruption-guarded,
small steps, every change logged and reversible. Model changes are recommended in the
log, never applied. See `apps/web/lib/assistantTuning.ts` for the (unit-tested) logic.

## Self-diagnosis

Ask Myra "how do you feel?", "are you okay?", or "run a diagnostic" and
she performs a live self-check (`run_self_diagnosis` in `agent.py`): she probes the
speech server (hearing/voice) and Claude reachability (thinking) over the network in
parallel, inspects the calendar snapshot and knowledge base she was handed, and
speaks a plain-language summary — naming any part that is down. This runs
deterministically, so it still works when the language model itself is unreachable.
These turns are logged to voice analytics under the `self_diagnosis` category.
The central registry, incident store, secure APIs, and admin dashboard are documented
in `../../docs/MYRA_DIAGNOSTICS.md`. The worker's `get_myra_health` tool refreshes
that structured status and falls back to the dispatch snapshot or local probes.

## Local services

The default development configuration expects:

- LiveKit Server: `ws://127.0.0.1:7880`
- Speaches: `http://127.0.0.1:8000`
- Parakeet STT: `http://127.0.0.1:8767`

## Language model

Myra thinks with **Claude Haiku 4.5** — the sole thinking engine (there is no
local fallback model). Set the key in `.env.local` (either this directory or the
repo root — both are loaded by absolute path, service first):

```
ANTHROPIC_API_KEY=sk-ant-...
```

**With no key set the agent raises on startup** — there is no offline floor.
When the API is unreachable at runtime, Myra degrades to deterministic answers
only (schedule, recap, navigation, learned). Optional overrides: `ANTHROPIC_MODEL`
(default `claude-haiku-4-5`), `ANTHROPIC_MAX_TOKENS` (512), `ANTHROPIC_TEMPERATURE`
(0.3), and the per-attempt bound `ANTHROPIC_ATTEMPT_TIMEOUT` (8.0s) /
`ANTHROPIC_MAX_RETRY` (1) applied via the session's `llm_conn_options`, so a
stalled request fails fast instead of stacking framework retries.

A `400 ... credit balance is too low` in the agent log means the API key is
valid but the account has no credits — Myra falls back to deterministic answers.
Add credits at console.anthropic.com under Plans &amp; Billing.

Copy `.env.example` to `.env.local` if it is not already present. Then:

1. Install dependencies:

   `uv sync --directory services/livekit-schedule-agent`

2. Download the LiveKit model files:

   `uv run --directory services/livekit-schedule-agent python -m schedule_agent.agent download-files`

3. Run the agent:

   `uv run --directory services/livekit-schedule-agent python -m schedule_agent.agent dev`

The agent dispatch name must remain `myra`, matching the
website token route.

## Restarting the agent

The agent runs as a bare detached process (not a Windows service). After changing
`agent.py`, restart just the agent — leaving LiveKit, Speaches, and Parakeet up — with:

```powershell
pnpm voice:restart-agent
```

This runs `scripts/restart-voice-agent.ps1`, which stops the agent process (worker +
child), then re-runs the idempotent `scripts/start-local-voice-stack.ps1` launcher so
only the agent is relaunched. No elevation required.
