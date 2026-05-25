# Windows Compatibility Notes

Last reviewed: 2026-05-24

## Target Runtime

- Windows host path: `C:\apps\suwaneegamers`
- Node.js: 22 LTS
- Package manager: pnpm 9
- Process manager: PM2
- Public ingress: Cloudflare Tunnel to `http://localhost:3000`
- Data source: external Knowledge Base at `http://kb.suwaneegamers.net`
- Schedule source: public Google Calendar embed and ICS feed

## Important Paths

Next.js standalone output for this monorepo is:

```text
C:\apps\suwaneegamers\apps\web\.next\standalone\apps\web\server.js
```

Static assets must be copied to:

```text
C:\apps\suwaneegamers\apps\web\.next\standalone\apps\web\.next\static
```

Public assets must be copied to:

```text
C:\apps\suwaneegamers\apps\web\.next\standalone\apps\web\public
```

## Deployment Flow

The Windows deploy script performs:

1. `git pull origin main`
2. `pnpm install --frozen-lockfile`
3. `pnpm --filter web build`
4. Copy `.next/static` into standalone output.
5. Copy `public` into standalone output.
6. Reload existing PM2 process or start it if missing.
7. Save PM2 process list.

## Verification Commands

From the repo root:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

After deploy:

```powershell
pm2 status
pm2 logs suwaneegamers-web
Invoke-WebRequest http://localhost:3000/api/calendar/events
```
