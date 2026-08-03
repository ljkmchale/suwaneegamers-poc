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
it with a timestamp and automatic-recovery note. The admin dashboard is always on;
`/admin/myra-health` shows every incident.

Email alerts are wired through `lib/healthNotifier.ts`. When `reconcileIncidents`
first opens a **critical** incident (a critical service is unavailable — the site,
database, Cloudflare route, or local AI) or resolves one, `getMyraHealth` fires a
fire-and-forget email. Because the alert triggers on the DB state *transition*, it
sends exactly once per outage and once per recovery, no matter which check (the
24/7 monitor or a live "how do you feel") detected it. A send failure is logged and
never fails the health check. Configure Gmail SMTP with `MYRA_ALERT_SMTP_USER`,
`MYRA_ALERT_SMTP_PASS` (a Google App Password), and `MYRA_ALERT_TO` in the web
process env; unset any of them and alerts stay on the dashboard only
(`myra_health_alert_skipped` is logged). Only critical transitions email; warnings
stay on the dashboard. Discord, Slack, and SMS remain future notifiers.

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
