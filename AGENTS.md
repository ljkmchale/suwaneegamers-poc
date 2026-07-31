# Agent Notes

Use this as the fast orientation file before editing this repo.

## Servers and Builds

- Dev server: `pnpm dev`, `http://localhost:3000`, normal `.next`.
- Production service: Windows NSSM service `SuwaneeGamers`, port `4652`, serves `apps/web/.next-prod`.
- Production build: `pnpm --filter web build:prod` builds the inactive
  immutable `.next-prod-a` or `.next-prod-b` slot. `scripts/restart-and-verify.ps1`
  stops the service and switches `.next-prod-active.json` to the completed
  slot. It never renames a compiled Next.js directory. `scripts/deploy-prod.ps1`
  performs both.
- Plain `pnpm build` updates `.next` only. It does not update production.
- Restart production from an elevated PowerShell prompt:

```powershell
C:\EaselLocal\nssm.exe restart SuwaneeGamers
```

If production still shows old UI after a code change, inspect
`.next-prod-ready.json` and `.next-prod-active.json`. Never rename a compiled
Next.js directory: its generated server files embed the original distDir.

## Content Data

Runtime content reads go through `apps/web/lib/contentFiles.ts`.

Important: `readContent()` checks `content/suwaneegamers.db` table `content_documents` first, then falls back to JSON files under `content/`. `writeContent()` writes both. If you manually edit a JSON file and the app still shows old data, sync/update the DB row.

Useful commands:

```bash
pnpm content:sync-documents
pnpm content:scheduler:once
pnpm content:sync-all
```

## Source-Managed Pages

Source-managed config lives in `content/auto-managed-pages.json`, but the running admin page reads the DB-backed copy first. For `/admin/source-managed` drift, inspect both:

- `content/auto-managed-pages.json`
- `content_documents.path = 'auto-managed-pages.json'` in `content/suwaneegamers.db`

The fold/back-to-top UI is code, not DB. If it is missing in production, rebuild `.next-prod` and restart `SuwaneeGamers`.

## Chronicles / Brain Vault

Chronicles is embedded in this Next app:

- Public UI: `/chronicles`
- Admin/DM UI: `/admin/chronicles`
- Query engine: `apps/web/lib/brain/`
- Vault content: `apps/web/brain-vault/`
- Maintenance scripts: `apps/web/brain-tools/`
- Generated index/cache: `apps/web/brain-data/`

The Source-Managed `/chronicles` row should mirror `apps/web/brain-tools/google-doc-sources.json`. The scheduler job id is `chronicles-sources`, which runs `apps/web/brain-tools/src/refresh-sources.mjs` to pull configured Google Docs, process stale raw sources, and rebuild the index when needed.

Keep public/player-safe Chronicles separate from admin/DM surfaces.

## Automatic Campaign Journeys

- Public UI: `/campaign-journeys` ("Myrdae in Motion")
- Generated content: `content/campaign-journeys.json`
- Generator: `scripts/sync-campaign-journeys.mjs`
- Scheduler job id: `campaign-journeys`, after session notes and Chronicles
- Map source: `https://mapeditor.suwaneegamers.net/api/world-data`
- Session source: SQLite `session_summaries`

The generator preserves curated seed stops, adds or replaces automatic stops by stable `campaign:session-N` source keys, and writes both JSON and the `content_documents` row. Off-map locations are anchored at the last mapped position and labeled `precision: "off-map"`; do not silently convert those anchors into canonical coordinates.

Useful commands:

```bash
pnpm sync-campaign-journeys
node scripts/sync-campaign-journeys.mjs --dry-run
```
