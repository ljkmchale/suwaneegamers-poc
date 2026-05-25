# Windows Machine — One-Time Setup Guide

Run these steps once on the Windows host that will serve the Suwanee Gamers portal.

## 1. Enable OpenSSH Server

```powershell
# Run as Administrator
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
```

Add your GitHub Actions deploy key to:

```text
C:\Users\<YourUser>\.ssh\authorized_keys
```

## 2. Install Node.js, pnpm, and PM2

Install Node.js 22 LTS from https://nodejs.org/.

```powershell
npm install -g pnpm@9 pm2
node --version
pnpm --version
pm2 --version
```

## 3. Clone the Repo

```powershell
mkdir C:\apps
cd C:\apps
git clone https://github.com/ljkmchale/suwaneegamers-poc.git suwaneegamers
cd suwaneegamers
```

## 4. Create the Production Env File

```powershell
Copy-Item apps\web\.env.example apps\web\.env
notepad apps\web\.env
```

Required values:

```env
GOOGLE_CALENDAR_ID=g3kgagicusaol82fqhjc62o47o@group.calendar.google.com
NEXT_PUBLIC_GOOGLE_CALENDAR_ID=g3kgagicusaol82fqhjc62o47o@group.calendar.google.com
NEXT_PUBLIC_GOOGLE_CALENDAR_COLOR=#fa573c
NEXT_PUBLIC_GOOGLE_CALENDAR_TIMEZONE=America/New_York
```

## 5. Install and Build

```powershell
pnpm install
pnpm --filter web build
```

Copy static assets into the standalone output:

```powershell
New-Item -ItemType Directory -Force apps\web\.next\standalone\apps\web\.next\static
Copy-Item apps\web\.next\static\* apps\web\.next\standalone\apps\web\.next\static\ -Recurse -Force
New-Item -ItemType Directory -Force apps\web\.next\standalone\apps\web\public
Copy-Item apps\web\public\* apps\web\.next\standalone\apps\web\public\ -Recurse -Force
```

## 6. Start with PM2

```powershell
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Verify:

```powershell
pm2 status
pm2 logs suwaneegamers-web
Invoke-WebRequest http://localhost:3000/api/calendar/events
```

## 7. Set up Cloudflare Tunnel

Install `cloudflared.exe` from https://github.com/cloudflare/cloudflared/releases and place it at:

```text
C:\cloudflared\cloudflared.exe
```

Authenticate and create the tunnel:

```powershell
cloudflared tunnel login
cloudflared tunnel create suwaneegamers
```

Create `C:\Users\<YourUser>\.cloudflared\config.yml`:

```yaml
tunnel: <YOUR-TUNNEL-UUID>
credentials-file: C:\Users\<YourUser>\.cloudflared\<UUID>.json

ingress:
  - hostname: suwaneegamers.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

Route DNS and install the service:

```powershell
cloudflared tunnel route dns suwaneegamers suwaneegamers.yourdomain.com
cloudflared service install
```

## Verification Checklist

- [ ] `pm2 status` shows `suwaneegamers-web` as `online`
- [ ] `http://localhost:3000` loads the portal
- [ ] Calendar page loads the shared Google Calendar
- [ ] Knowledge Base links open `http://kb.suwaneegamers.net`
- [ ] Cloudflare Tunnel URL loads from another network
