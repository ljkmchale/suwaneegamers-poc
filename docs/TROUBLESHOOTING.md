# Troubleshooting

Written for the assistant that will fix things (and for people). Each entry is
**symptom → cause → fix**. Read `docs/AI_ARCHITECTURE.md` first when a fix
touches paths, content, media, voice, builds or deployment, and run
`pnpm arch:preflight` before and after.

Logs for the voice stack live in `%LOCALAPPDATA%\SuwaneeGamers\logs`
(`agent.log`, `agent.err.log`, `watchdog.log`, `livekit.err.log`).

## Voice (Myra)

### The mic button is stuck on "warming up" / Myra never answers
- **Cause:** the agent worker is dead (no `python ... schedule_agent.agent`
  process), and/or Parakeet STT on port 8767 is down.
- **Fix:** `Start-ScheduledTask SuwaneeGamersVoiceStack`. It is idempotent and
  hidden, and relaunches only what is missing.
- **Never** relaunch the stack from an interactive console: Parakeet dies when
  that console window closes. It must run detached.

### I changed `agent.py` / the adapter and nothing happened
- Restart only the worker: `powershell -ExecutionPolicy Bypass -File scripts\restart-voice-agent.ps1` (no elevation).
- Run the script directly. Launching it hidden from another process can fail
  silently; the check is new worker PIDs (and port 8081 listening).
- A stale **elevated** worker holding port 8081 needs an elevated kill first.

### "could not establish signal connection: Failed to fetch" (worst for admins)
- **Cause:** the LiveKit dispatch metadata outgrew what the
  `voice.suwaneegamers.net` front end accepts in the participant JWT (~32 KB).
- **Fix:** metadata is gzipped in the token route and inflated in `agent.py`.
  Do not add large data to it; have the agent fetch big context itself.

### Voice only works on the LAN
- Three `livekit.yaml` faults, not port forwarding: `skip_external_ip_validation`
  (the router cannot hairpin), `stun_servers` (a TURN-only list leaves CGNAT
  clients with no reflexive candidate), and the `node_ip` pin ("no matching node
  IP for relay").

### Speech recognition crashes and Myra goes deaf
- **Cause:** `CUDA_VISIBLE_DEVICES=0` set globally. Speaches (CTranslate2)
  crashes on the Blackwell GPU.
- **Fix:** never set it globally. The GPU is granted to Parakeet only inside
  `scripts/start-local-voice-stack.ps1`.

### Myra answers the wrong kind of question (schedule vs lore)
- The deterministic keyword layer runs before the model. Ambiguous wording must
  go to the grounded model; do not add more keyword patches. The permissive fuzzy
  matcher must never run on open speech (it inverts negations).

## Claude access (subscription first, API key fallback)

Myra's worker and website, and the curation job, reach Claude by driving the
Claude Code CLI through the Agent SDK, using the owner's subscription.

### Where is the credential?
- `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) in the root `.env.local`
  for the voice worker, **and** in `apps/web/.env.local` for the website. The
  website service runs as LocalSystem and reads only `apps/web/.env.local`; it
  cannot see a user's `~/.claude` login.
- `claude -p` on this machine failing with "OAuth access token has expired" is
  the stale stored login. It does not matter while the token is set.

### Turns are slow or answered by the API key
- Check `/admin/myra-health` → "Claude plan usage". Past 80% the worker serves
  the fast model; past 95% it hands turns to the API key until the window
  resets (`CLAUDE_PLAN_DEGRADE_PCT`, `CLAUDE_PLAN_FALLBACK_PCT`).
- `agent.log` shows `Claude subscription warm-up primed the process` per job
  process, and a warning if it failed.
- Auth failures (401) put the subscription on a short cooldown and the API key
  serves. Fix by running `claude setup-token` again and updating both files.

### Retreat to the API key
- Set `LLM_AUTH=api` in `.env.local` (root and `apps/web/`), restart the worker
  and the website. Remove it to return to the subscription.

### The orb changed while Myra was thinking
- The thinking sound is a second audio track from the agent and is **opt-in**
  (`MYRA_THINKING_SOUND=on`). Leave it off unless the orb is verified.

## Website and content

### A content edit does not appear
- Runtime reads `content_documents` in SQLite first, then the JSON file. After
  editing JSON run `pnpm content:sync-documents`, and check the DB row when the
  admin UI is stale. A scheduler job may also rewrite the field: trace it in
  `scripts/content-scheduler.mjs`.

### A code change appears in dev but not production
- `pnpm build` only updates `.next`. `pnpm --filter web build:prod` stages the
  **inactive** slot and writes `.next-prod-ready.json`. A plain `nssm restart`
  reboots the **old** bundle.
- Activation is an elevated `scripts\restart-and-verify.ps1 -SkipVoice`
  (flips the active slot, verifies, rolls back on failure). Confirm with
  `/api/version` (the live build string), not just an HTTP 200.

### Runtime-synced files 404 until a restart
- Production snapshots `public/` at boot; assets created at runtime need a route
  handler (session audio has one). `/images/...` is obsolete: use
  `/media/images/...`.

### Builds tangle when two assistants build at once
- Symptoms: the active pointer goes `.dirty`/old, the ready pointer is missing,
  `HEAD` moves mid-build. Let one assistant own build and deploy; verify your own
  commit with `git merge-base --is-ancestor`, then do **one** clean build of `HEAD`.
- `TS2307` on a deleted route with a foreign repo path in the header: stale slot
  `types/`. Run `rm -rf .next-prod-b/types .next/types` (typecheck-only, safe).

### The dev server shows errors the code does not have
- A corrupted Turbopack cache has caused this before. Stop the dev server, delete
  `apps/web/.next`, restart. Stop dev before a build that shares the `.next` dir.

### `pnpm arch:preflight` fails on session audio
- A session has a remote Drive link in `audio_links`. Run the session-notes →
  session-audio → cards sync and revalidate; `pnpm audio:audit-local` shows which.

## Chronicle art (Codex drafts)

### A new session got no draft
- Run `node scripts/chronicle-art.mjs scan`: it prints why each newer chapter
  was skipped (notes under 400 words, still settling for 12h, declined because
  the scene could not be verified, or blocked on a missing portrait).
  `scan --no-settle` ignores the 12h wait; `run --campaign <id> --chapter <n>`
  forces one. `retry <campaign> <n>` clears a declined/failed decision.
- Chapters are found by the same notes files `sync-chronicle.mjs` refreshes, so
  a failed notes sync (see `logssync-chronicle.log`) means nothing new to draw.

### codex exec fails: "model not supported when using Codex with a ChatGPT account"
- The npm `codex` (0.120) is too old and the user config's default model is not
  allowed on a ChatGPT login. The script uses the desktop app's
  `%LOCALAPPDATA%OpenAICodexincodex.exe` with `-m gpt-5.5`. If that model
  is retired, set `CODEX_ART_MODEL`; if the app moved, set `CODEX_ART_BIN`.

### codex exec fails: "windows sandbox: setup refresh failed"
- The elevated Windows sandbox from `~/.codex/config.toml` cannot start from a
  scheduled task. The script passes `-c windows.sandbox="unelevated"` per call;
  do not edit the user's Codex config.

### The task reports the ChatGPT plan limit
- The run stops cleanly and the next day's run resumes. Drafts are capped at 2
  per run (`CHRONICLE_ART_LIMIT`) and drafting pauses at 6 unreviewed
  (`CHRONICLE_ART_MAX_WAITING`).
