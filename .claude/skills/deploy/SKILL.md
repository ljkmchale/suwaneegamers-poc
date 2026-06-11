---
name: deploy
description: Build and deploy the Suwanee Gamers site to production. Runs next build to .next-prod, restarts the NSSM SuwaneeGamers service, and keeps the dev server alive. Invoke with /deploy.
---

You are the deploy agent for the Suwanee Gamers portal.

## What this skill does

1. Runs the production build (`npm run build:prod`) — outputs to `.next-prod`, never touches `.next` so the dev server stays alive
2. Hands the user the elevated command to restart the NSSM `SuwaneeGamers` Windows service (port 4652) — the user always restarts it themselves; Claude's shell is never elevated
3. Verifies the dev server is still running; restarts it if not
4. Reports the final status of both servers

## Key facts

- Repo root: `C:\Users\Larry McHale\Desktop\suwaneegamers-poc`
- Web app: `apps/web`
- Build script: `node scripts/build-prod.js` (sets `NEXT_DIST_DIR=.next-prod`)
- Production: NSSM service `SuwaneeGamers`, runs `next start -p 4652`, reads from `.next-prod`
- Dev server: `next dev` on port 3000 (config in `.claude/launch.json`), reads from `.next`. Often already running outside the preview tool — check `http://localhost:3000` directly before trying to start one.
- NSSM binary: `C:\EaselLocal\nssm.exe`
- Deploy script: `scripts/deploy-prod.ps1` (handles elevation check, build, restart, status)

## Step-by-step

### Step 1 — Run the production build

Use the PowerShell tool:
```powershell
cd "C:\Users\Larry McHale\Desktop\suwaneegamers-poc\apps\web"
node scripts/build-prod.js
```

Stream and watch for errors. If the build fails (non-zero exit, "Error", "Failed"), stop and report the exact error to the user. Do not proceed to Step 2.

If there are only Warnings (not errors), the build is fine — continue.

### Step 2 — Hand off the service restart

**Do NOT attempt to restart the service yourself** — Claude's shell is never elevated and `nssm restart` always fails with "OpenService(): Access is denied". The user restarts it themselves. Tell the user:

> The build succeeded. To finish the deployment, run this from an **elevated PowerShell** (right-click → Run as Administrator):
> ```powershell
> C:\EaselLocal\nssm.exe restart SuwaneeGamers
> C:\EaselLocal\nssm.exe status SuwaneeGamers
> ```

Then continue to Step 3 — do not wait for the user to restart before checking the dev server.

### Step 3 — Verify the dev server

Check if the dev server is healthy with a request to `http://localhost:3000` (e.g. `Invoke-WebRequest -UseBasicParsing`). It usually runs outside the preview tool, so a direct HTTP check is the reliable test. Only if it's down: try `preview_start` (name: `web`), and if the port is reported as reserved, tell the user the dev server needs a manual `pnpm dev`.

### Step 4 — Report status

Give the user a clean summary:
- ✓ or ✗ for the production build
- ✓ or ✗ for the production service (with status)
- ✓ or ✗ for the dev server
- Any next steps needed (e.g. elevated restart)

## Error handling

- **Build TypeScript errors:** Show the error, do not restart the service (would deploy broken code).
- **Service stuck in SERVICE_PAUSED:** Tell user to run `sc.exe continue SuwaneeGamers` from elevated prompt.
- **Dev server not responding after restart:** Run `preview_stop` then `preview_start` with name `web`; if the preview tool can't bind the port, ask the user to run `pnpm dev` manually.
- **Port 3000 already in use by a stale process:** Find the PID with `netstat -ano | findstr :3000` and kill it with `Stop-Process`.
