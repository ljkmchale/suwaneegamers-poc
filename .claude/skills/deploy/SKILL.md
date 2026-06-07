---
name: deploy
description: Build and deploy the Suwanee Gamers site to production. Runs next build to .next-prod, restarts the NSSM SuwaneeGamers service, and keeps the dev server alive. Invoke with /deploy.
---

You are the deploy agent for the Suwanee Gamers portal.

## What this skill does

1. Runs the production build (`npm run build:prod`) — outputs to `.next-prod`, never touches `.next` so the dev server stays alive
2. Restarts the NSSM `SuwaneeGamers` Windows service (port 4652) if elevated, or gives the user an exact command if not
3. Verifies the dev server on port 3001 is still running; restarts it if not
4. Reports the final status of both servers

## Key facts

- Repo root: `C:\Users\Larry McHale\Desktop\suwaneegamers-poc`
- Web app: `apps/web`
- Build script: `node scripts/build-prod.js` (sets `NEXT_DIST_DIR=.next-prod`)
- Production: NSSM service `SuwaneeGamers`, runs `next start -p 4652`, reads from `.next-prod`
- Dev server: preview tool `web` config in `.claude/launch.json`, port 3001, reads from `.next`
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

### Step 2 — Restart the production service

Try with the PowerShell tool (may fail if not elevated):
```powershell
C:\EaselLocal\nssm.exe restart SuwaneeGamers
Start-Sleep -Seconds 3
C:\EaselLocal\nssm.exe status SuwaneeGamers
```

**If status is `SERVICE_RUNNING`:** success — continue to Step 3.

**If access is denied or status is not `SERVICE_RUNNING`:** Tell the user:
> The build succeeded. To finish the deployment, run this from an **elevated PowerShell** (right-click → Run as Administrator):
> ```powershell
> C:\EaselLocal\nssm.exe restart SuwaneeGamers
> C:\EaselLocal\nssm.exe status SuwaneeGamers
> ```

### Step 3 — Verify the dev server

Check if the preview server is running:
- Use `preview_list` to see running servers
- If `web` is not in the list, start it with `preview_start` (name: `web`)
- If it is running, confirm it's healthy with a quick `curl http://localhost:3001`

### Step 4 — Report status

Give the user a clean summary:
- ✓ or ✗ for the production build
- ✓ or ✗ for the production service (with status)
- ✓ or ✗ for the dev server
- Any next steps needed (e.g. elevated restart)

## Error handling

- **Build TypeScript errors:** Show the error, do not restart the service (would deploy broken code).
- **Service stuck in SERVICE_PAUSED:** Tell user to run `sc.exe continue SuwaneeGamers` from elevated prompt.
- **Dev server not responding after restart:** Run `preview_stop` then `preview_start` with name `web`.
- **Port 3001 already in use:** Find the PID with `netstat -ano | findstr :3001` and kill it with `Stop-Process`.
