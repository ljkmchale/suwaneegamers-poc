# AI Architecture Preflight

This is the canonical orientation contract for any AI model or developer changing this repository. Read it and run `pnpm arch:preflight` before editing paths, content, images, audio, video, synchronization, voice, builds, or deployment.

On a CI runner, the preflight validates tracked source and architecture paths but skips the production database, cached session audio, and their runtime media audits because those machine-local artifacts are intentionally excluded from Git. A preflight run on the production machine remains the authoritative check for those runtime assets.

The machine-readable companion is `docs/architecture-contract.json`. If this guide, the contract, and runtime code disagree, stop and trace the runtime code before changing anything; then update the guide and contract in the same change.

## The five paths every change must trace

1. **Render path**: route under `apps/web/app/` -> domain reader under `apps/web/lib/` -> renderer/component.
2. **Data path**: runtime reads SQLite `content_documents` first through `apps/web/lib/contentFiles.ts`, then falls back to `content/`. Update both with `writeContent()` or run `pnpm content:sync-documents` after an intentional file edit.
3. **Automation path**: inspect `scripts/content-scheduler.mjs` and every sync/generator that can rewrite the same field. A manual repair is incomplete if a scheduled job can restore the old value.
4. **Asset path**: browser URL, route handler, and disk path are different layers. Never derive one by guessing from another.
5. **Activation path**: a source edit, a production build, and switching/restarting the active production slot are separate operations.

## Canonical locations and URL contracts

| Domain | Disk/source location | Browser/runtime contract |
| --- | --- | --- |
| Images | `apps/web/media/images/` | `/media/images/...` through `apps/web/app/media/images/[...segments]/route.ts` |
| Session audio | `apps/web/media/session-audio/` | `/media/session-audio/...` through `apps/web/app/media/session-audio/[...segments]/route.ts` |
| Editable JSON | `content/` | SQLite `content_documents` wins at runtime |
| Page layouts | `content/page-layouts/` | Rendered by `apps/web/components/blocks/BlockRenderer.tsx` |
| Main database | `content/suwaneegamers.db` | SQLite via `better-sqlite3` |
| Scheduled rewrites | `scripts/content-scheduler.mjs` | Runs beside production Next.js |
| Myra web client | `apps/web/components/livekit/ScheduleVoiceAssistant.tsx` | Requests `/api/livekit/token` |
| Myra worker | `services/livekit-schedule-agent/src/schedule_agent/agent.py` | LiveKit 7880, Speaches 8000, Parakeet 8767, Claude (subscription via the Claude Agent SDK, `claude_subscription.py`; Anthropic API key as fallback) |
| Myra diagnostics | `apps/web/lib/myraHealth.ts` | `/api/myra/health/*` and `/admin/myra-health` |
| Security enforcement | `apps/web/lib/securityLog.ts`, `apps/web/lib/cloudflareSecurity.ts` | `/admin/security` -> zone-scoped Cloudflare IP Access rules |
| Production build | inactive `.next-prod-a` or `.next-prod-b` | active slot selected by `.next-prod-active.json` |
| Production service | `apps/web/scripts/start-prod.js` | NSSM `SuwaneeGamers`, port 4652 |

Each production slot contains `BUILD_METADATA.json` with a human-readable
version, Next build ID, Git commit/branch, dirty-worktree flag, and UTC build
time. The same metadata is copied into the ready pointer, loaded by
`start-prod.js`, and reported by `GET /api/version`. Treat that endpoint as the
authoritative identity of the bundle actually running in production.

Claude access runs through the owner's Claude subscription when a credential
exists. The voice worker (`claude_subscription.py`) and the website
(`apps/web/lib/claudeSubscription.ts`, used by `lib/brain/ai-client.ts`) drive
the Claude Code CLI through the Claude Agent SDK with every built-in tool
disabled and `ANTHROPIC_API_KEY` removed from the CLI's environment; the
Anthropic API key remains the automatic fallback, then Groq for the brain.
Credentials are `claude auth login` for the user that runs the voice stack, or
`CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) in `.env.local`, which is
required for the NSSM website service because it runs as LocalSystem and cannot
read a user's `~/.claude`. `LLM_AUTH=api` forces the API key everywhere. Voice
metrics record the provider as `claude-code-subscription` (estimated API cost
0). Activate worker changes with `scripts/restart-voice-agent.ps1`; website
changes need a production build and slot activation.

Myra searches Chronicles through `/api/brain/ask`. Voice searches default to
player-safe sources. Larry and Chip are configured in `MYRA_FULL_DM_EMAILS` for
cross-campaign access. Other authenticated DMs receive a short-lived signed
capability limited to campaigns currently assigned to them in
`dungeon_masters` / `campaign_dms`; inactive or unrelated campaigns remain
player-safe.

Myra's recap turn handler uses `services/livekit-schedule-agent/src/schedule_agent/planning.py`
to preserve recap, documented participant lookup, and upcoming-game requests in
one bounded read plan. Campaign aliases resolve from the worker catalog and
approved dispatch recaps; a single profile campaign may supply the default.
Ambiguous campaigns require clarification. Recap/calendar reads use approved
dispatch snapshots unless a verified newer player-safe session is indexed;
newer recap and participant lookup use `/api/brain/ask` with the existing
visibility and signed capability. Model routing overrides bypass this path.
Reads run off the event loop with a 28-second outer timeout and stale-turn
checks. Activate worker-only code with `scripts/restart-voice-agent.ps1`; the
website slot does not need rebuilding for this Python-only change.

The `chronicles-sources` scheduler runs `brain-tools/src/refresh-sources.mjs`.
After pulling notes, `sync-session-pages.mjs` publishes missing dated session
pages from exact source text, with approved SQLite summaries as fallback.
Existing curated pages are preserved. `session-pages.mjs` writes coverage to
`apps/web/brain-data/session-freshness.json`; the indexer stamps a latest session
only when its body hash and player visibility match the successfully saved
index. Index and catalog writes are atomic. Myra reads this manifest to detect
dispatch lag, then uses the authenticated API for the actual answer. A failed
newer lookup must never describe an older dispatch recap as the latest session.
A New Adventure is supported in the web/tools campaign catalogs and worker
aliases, with its player-notes document in the scheduled source configuration.
Campaign abbreviations match whole words so ordinary words such as "analysis"
cannot select ANA. Source notes can be newer than the separately authored DB
summaries. Keep the source-managed Library row aligned with configured sources.
Planner reads send `sessionTitle` to `/api/brain/ask`; both query engines select
only that session's indexed page and chunks within the requested campaign and
authorized visibility. The selected-session path skips broad retrieval and
cached generic answers. Unknown, hidden, or mismatched sessions return no
evidence. Voice name correction protects exact campaign phrases before fuzzy
entity repair, so navigation labels cannot rewrite A New Adventure.
The worker retains only adjacent recap context: a short campaign clarification
resumes the pending request, a campaign correction replaces its scope, and a
participant or recap follow-up keeps that scope. An unrelated turn clears it.
This state does not grant access; every lookup retains the existing API checks.

Passive usage-purpose learning is first-party analytics, not model training.
`AnalyticsTracker.tsx` sends the existing interaction stream through
`/api/analytics/events`; `apps/web/lib/usagePurpose.ts` classifies meaningful
page, engagement, action, search, and media signals into durable
`analytics_purpose_signals` rows. Myra voice-question categories write into the
same purpose vocabulary without copying the question text. Future metrics must
aggregate these confidence-tagged signals by distinct visit rather than treating
every low-confidence page view as a separate user intent.

Security events are recorded in `security_events`. High-confidence public
scanner and failed-login bursts can create reversible Cloudflare edge blocks in
`security_blocks`; automatic enforcement only trusts requests carrying both
`CF-Connecting-IP` and `CF-Ray`. Cloudflare writes require the dedicated
`CLOUDFLARE_SECURITY_API_TOKEN` and `CLOUDFLARE_SECURITY_ZONE_ID`; never reuse
the DNS/TURN token. Restrict that token to `Zone > Firewall Services > Edit`
for only `suwaneegamers.net`. Manual Block/Unblock controls live at
`/admin/security`.
Credential/secret-file probes, installer or web-shell paths, and non-read
requests to suspicious paths block immediately. Never block Cloudflare's shared
cross-zone Worker source `2a06:98c0:3600::103`; it is not a visitor identity.

Member access restrictions are separate from Cloudflare IP blocks. The
`member_blocks` table is enforced by `proxy.ts` on gated member requests
and by both OAuth callbacks. `/api/brain/ask` checks browser sessions against
the same table itself because machine callers bypass the proxy's member gate;
authenticated machine requests retain their separate bearer authorization.
A rejected identity at the sign-in gate receives a short-lived sealed
review token; `/signin` uses it to submit a verified request into
`member_unblock_requests`. Pending requests and the Unblock/Keep blocked
decisions live at `/admin/members`. Internal block reasons are admin-only.

Operating costs live in two places. `content/service-costs.json` (DB-first via
`contentFiles.ts`, edited at `/admin/services`) is the catalog of outside
services with plan prices, renewal dates, and billing/usage links. Actual
charges are rows in the `service_payments` table (`apps/web/lib/servicePayments.ts`,
`/admin/services/payments`), keyed to the catalog by `service_id` with a
`service_name` snapshot so history survives renames. No scheduled job writes
either one.

`/images/...` is obsolete. Files under `apps/web/media/images/` must be referenced as `/media/images/...`. Do not put site media back under `public/` unless the architecture contract is deliberately migrated everywhere.

## Change-impact checklist

Before editing, identify every applicable row:

| Change | Inspect before editing | Verify after editing |
| --- | --- | --- |
| Text/layout | route, renderer, JSON, `content_documents`, sync job | DB/file parity and rendered route |
| Image/media | stored URL, route handler, disk file, generator, optimizer | `pnpm images:audit-local` and exact asset HTTP content type |
| Session audio | `session_summaries.audio_links`, cache file, audio sync, player | `pnpm audio:audit-local` and playable route |
| Campaign content | `campaigns` table, campaign layout, archive layout, header/session/roster jobs | focused campaign/content-integrity tests |
| Voice/Myra | client, token route, LiveKit, worker, Speaches, Claude (subscription CLI, then API key), analytics | token, room/worker, transcription, non-silent TTS, analytics separately |
| Production UI/code | source, inactive production slot, active pointer, NSSM process | distinctive live result on port 4652, not only HTTP 200 |
| Security enforcement | proxy/login source, trusted Cloudflare headers, thresholds, provider rule id, admin recovery | focused security tests, configured-state UI, reversible provider operation |

## Required completion rule

Living Chronicle HTML is read directly from `content/chronicles/<campaign>.html`
by `apps/web/app/(site)/campaigns/[id]/chronicle/route.ts`; it is not a
`content_documents` row. `scripts/sync-chronicle.mjs` rebuilds it from each
campaign's notes and builder. HOE and SoD additionally read their own
`session-sequences.json` beside `session-images.json`, through
`scripts/lib/chronicle-story.mjs`. Sequences cycle in the existing hero area
without controls; the original single-image map remains the fallback. Keep
accepted image assets in the canonical media directory. Draft previews in
`artwork-drafts/` are separate from these scheduled and served files.

New-session hero art is drafted by `scripts/chronicle-art.mjs` (queue, gates
and approval) with the pure helpers in `scripts/lib/chronicle-art-notes.mjs`. It
runs as the user-level scheduled task "SuwaneeGamers Chronicle Art"
(`scripts/chronicle-art.cmd`, after the 10:34 Chronicle Sync), **not** as a
`content-scheduler.mjs` job: that scheduler runs as LocalSystem under NSSM and
cannot see the Codex ChatGPT login in `~/.codex`. It drives the Codex desktop
app's `codex.exe` (`CODEX_ART_BIN`, model `CODEX_ART_MODEL`, default gpt-5.5)
with each campaign's skill in `~/.codex/skills/<campaign>-chronicle-scenes`.
A chapter is drafted only when it is newer than the highest key in that
campaign's `session-images.json`, has real notes (400+ words) unchanged for 12h,
Codex's scene brief quotes the notes verbatim (verified by the script), and the
skill reports no missing required portrait. Drafts, briefs and the ledger live in
`artwork-drafts/chronicle-queue/` (git-ignored, never served); the only writer
of served files is the publish step (`approve`, or automatically after a draft
whose Codex self-review passed; `CHRONICLE_ART_AUTO_APPROVE=0` disables that),
which writes the WebP under
`apps/web/media/images/chronicles/<campaign>/`, the chapter's key in
`session-images.json`, then rebuilds and copies `content/chronicles/<campaign>.html`
exactly as `sync-chronicle.mjs` does. A draft whose self-review failed stays
queued for manual `approve`/`reject`. Auto-published files are working-tree
changes: they are not committed or pushed by the task.

The same helper reads optional `session-videos.json` chapter-to-MP4 mappings.
Accepted videos live alongside Chronicle artwork under `/media/images/` (the
dynamic media handler supports `video/mp4`). They loop muted in the hero while
visible, pause offscreen, and retain the original still on playback failure or
when reduced motion is requested. These content-only changes need no app build.

A change is not complete until the writer has checked for other writers. Search the repository and scheduler for the field, URL prefix, filename, or table being changed. Run `pnpm arch:preflight` again after the edit, plus the domain-specific tests. Report any sign-in gate or service permission that prevents rendered verification.
