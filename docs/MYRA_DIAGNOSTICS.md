# Myra diagnostics

Myra's health system is centralized in `apps/web/lib/myraHealth.ts`. It exposes a
typed registry, parallel timeout-isolated checks, short-lived caches, capability
flags, sanitized structured logs, and SQLite-backed incident history. The older
worker-local speech/Ollama check remains a fallback if the central service cannot
be reached.

## Monitored services

| Service | Critical | Test | Default timeout |
| --- | --- | --- | --- |
| Suwanee Gamers database | Yes | SQLite read plus temporary-table write | 2 seconds |
| Local fallback AI | Yes | Ollama model-list endpoint | 4 seconds |
| Website API | Yes | Calendar API request | 5 seconds |
| Karpathy LLM Wiki and memory | No | learned-memory row and storage access | 2 seconds |
| Chronicles search | No | brain-data storage access | 2 seconds |
| Speaches STT/TTS | No | model-list endpoint | 4 seconds |
| Parakeet primary STT | No | GPU model-list endpoint on port 8767 | 4 seconds |
| LiveKit | No | local TCP connection | 3 seconds |
| Claude | No | configuration presence; live failures remain worker-observed | 2 seconds |
| Runtime | No | process memory, uptime, and free disk | 1 second |

Voice, memory, website-data, and external-provider failures are kept separate so
a secondary outage does not incorrectly mark all of Myra unavailable. Browser-only
microphone permission, audio playback, and WebSocket state are client-session facts;
they cannot be honestly inferred by the server-wide dashboard and remain surfaced
by the LiveKit client when a session is active.

## Depth, cache, and configuration

Quick checks use `MYRA_HEALTH_QUICK_INTERVAL_MS` (default 60 seconds). Full checks
use `MYRA_HEALTH_FULL_INTERVAL_MS` (default 5 minutes) but an admin-requested full
diagnostic forces refresh. Component checks accept only registered IDs or groups.
The worker uses `SUWANEE_GAMERS_BASE_URL` and optional `MYRA_INTERNAL_API_TOKEN`.
Set `MYRA_WEBSITE_HEALTH_URL` when the production loopback URL differs.
The monitor also checks `MYRA_CLOUDFLARE_HEALTH_URL` (defaulting to
`https://www.suwaneegamers.net/signin`) and verifies Cloudflare response headers.
This keeps the local Next.js listener and the public Cloudflare Tunnel path as
separate critical checks.

Production `start-prod.js` launches `scripts/myra-health-monitor.mjs` beside Next
and the content scheduler. It forces a quick check every minute and a full check
every five minutes, so outages and recoveries are recorded even when nobody asks
Myra a health question. Set `MYRA_HEALTH_MONITOR=0` only to disable it deliberately.

Development-only simulation is enabled with `MYRA_HEALTH_TEST_MODE=true`, then
`MYRA_HEALTH_SIMULATE=memory:unavailable,speaches:degraded`. Simulation is disabled
in production regardless of these values.

## Incidents and alerts

`myra_health_incidents` groups repeated failures by service. A failure opens one
incident, repeated checks update its count/severity, and a successful check resolves
it with a timestamp and automatic-recovery note. The admin dashboard is the built-in
alert channel. Email, Discord, Slack, and SMS require a future configured notifier;
no credentials or outbound messages are assumed.

## API and security

- `GET /api/myra/health/summary` returns sanitized capability-level data.
- Detailed health, service registry, and incidents require the admin session or
  `MYRA_INTERNAL_API_TOKEN`.
- `POST /api/myra/health/check` is admin-only and rate-limited.
- `POST /api/myra/health/check/:service` validates the service or group.

Technical details never include environment dumps, internal URLs, credentials, or
stack traces. Logs contain a correlation ID, service, status, response time, and
sanitized error code only.

## Adding a check

Add one `HealthCheck` entry to `healthRegistry`. Give it a stable ID, display name,
group, criticality, timeout, and isolated `run` function returning a
`DiagnosticResult`. Add aggregation, timeout, simulation, and recovery tests before
marking it critical.

## Troubleshooting

Use `/admin/myra-health` for quick/full checks and details. Confirm database access,
then LiveKit 7880, Speaches 8000, Ollama 11434, and the website API independently.
For a real voice failure, also verify browser microphone permission, room join,
transcription, and non-silent TTS; a healthy server port alone is insufficient.
