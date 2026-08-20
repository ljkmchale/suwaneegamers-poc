# AI Architecture Preflight

This is the canonical orientation contract for any AI model or developer changing this repository. Read it and run `pnpm arch:preflight` before editing paths, content, images, audio, video, synchronization, voice, builds, or deployment.

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
| Myra worker | `services/livekit-schedule-agent/src/schedule_agent/agent.py` | LiveKit 7880, Speaches 8000, Ollama 11434 |
| Myra diagnostics | `apps/web/lib/myraHealth.ts` | `/api/myra/health/*` and `/admin/myra-health` |
| Security enforcement | `apps/web/lib/securityLog.ts`, `apps/web/lib/cloudflareSecurity.ts` | `/admin/security` -> zone-scoped Cloudflare IP Access rules |
| Production build | inactive `.next-prod-a` or `.next-prod-b` | active slot selected by `.next-prod-active.json` |
| Production service | `apps/web/scripts/start-prod.js` | NSSM `SuwaneeGamers`, port 4652 |

Each production slot contains `BUILD_METADATA.json` with a human-readable
version, Next build ID, Git commit/branch, dirty-worktree flag, and UTC build
time. The same metadata is copied into the ready pointer, loaded by
`start-prod.js`, and reported by `GET /api/version`. Treat that endpoint as the
authoritative identity of the bundle actually running in production.

Myra searches Chronicles through `/api/brain/ask`. Voice searches default to
player-safe sources. Larry and Chip are configured in `MYRA_FULL_DM_EMAILS` for
cross-campaign access. Other authenticated DMs receive a short-lived signed
capability limited to campaigns currently assigned to them in
`dungeon_masters` / `campaign_dms`; inactive or unrelated campaigns remain
player-safe.

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

`/images/...` is obsolete. Files under `apps/web/media/images/` must be referenced as `/media/images/...`. Do not put site media back under `public/` unless the architecture contract is deliberately migrated everywhere.

## Change-impact checklist

Before editing, identify every applicable row:

| Change | Inspect before editing | Verify after editing |
| --- | --- | --- |
| Text/layout | route, renderer, JSON, `content_documents`, sync job | DB/file parity and rendered route |
| Image/media | stored URL, route handler, disk file, generator, optimizer | `pnpm images:audit-local` and exact asset HTTP content type |
| Session audio | `session_summaries.audio_links`, cache file, audio sync, player | `pnpm audio:audit-local` and playable route |
| Campaign content | `campaigns` table, campaign layout, archive layout, header/session/roster jobs | focused campaign/content-integrity tests |
| Voice/Myra | client, token route, LiveKit, worker, Speaches, Ollama, analytics | token, room/worker, transcription, non-silent TTS, analytics separately |
| Production UI/code | source, inactive production slot, active pointer, NSSM process | distinctive live result on port 4652, not only HTTP 200 |
| Security enforcement | proxy/login source, trusted Cloudflare headers, thresholds, provider rule id, admin recovery | focused security tests, configured-state UI, reversible provider operation |

## Required completion rule

A change is not complete until the writer has checked for other writers. Search the repository and scheduler for the field, URL prefix, filename, or table being changed. Run `pnpm arch:preflight` again after the edit, plus the domain-specific tests. Report any sign-in gate or service permission that prevents rendered verification.
