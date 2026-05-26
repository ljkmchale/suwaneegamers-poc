# Suwanee Gamers Website Inventory

Last reviewed: 2026-05-26

## What This Website Is

Suwanee Gamers is now a lightweight portal for the table. It does not own campaign canon, lore, characters, sessions, or world data. The old Google Site at `https://sites.google.com/view/suwanee-gamers/home` is the migration/reference source for portal structure, campaign roster details, and any remaining information that still needs to be carried forward. The Knowledge Base at `http://kb.suwaneegamers.net` is the destination for deeper table material.

The portal should focus on:

- Opening the Knowledge Base quickly.
- Embedding the shared Google Calendar.
- Linking to D&D Beyond and other external campaign tools.
- Preserving a polished Suwanee Gamers front door for players and DMs.

## Source Rules

- Old Google Site source for portal structure and campaign information: `https://sites.google.com/view/suwanee-gamers/home`.
- Knowledge Base destination for deeper Myrdae and campaign material: `http://kb.suwaneegamers.net`.
- Calendar source: `g3kgagicusaol82fqhjc62o47o@group.calendar.google.com`.
- If these disagree, verify with the user or the reference site before changing campaign-facing copy.

## Migration Source Tracker

- Legacy site home: `https://sites.google.com/view/suwanee-gamers/home`
- Use this as the first stop when continuing migration of public-facing table information into the new portal or the Knowledge Base.
- Preserve the old site's campaign names, DM labels, schedules, resource links, and page relationships unless a newer source supersedes them.

## Technology Stack

- Framework: Next.js 15 App Router with React 19.
- Styling: Tailwind CSS 4 plus custom fantasy design tokens in `app/globals.css`.
- Calendar: public Google Calendar embed plus public ICS parsing for upcoming events.
- Animation/visuals: Framer Motion, Three.js via React Three Fiber, tsparticles.
- Deployment target: Windows host running PM2 and Cloudflare Tunnel.

## Main Routes

| Route | Purpose |
|---|---|
| `/` | Portal home with primary links to KB, calendar, D&D Beyond, and legacy reference site. |
| `/calendar` | Embedded shared Google Calendar plus upcoming event list from the ICS feed. |
| `/campaigns` | Legacy-style active campaign index with legacy header art, campaign title, cadence, DM, and optional next calendar date. |
| `/campaigns/[id]` | Legacy-style campaign detail page with legacy header art, resource links, notes/party roster, and session summaries dynamically pulled from the matching Google Site reference page. |
| `/dungeon-masters` | DM roster cards with descriptions, active campaign ownership, and previous campaign history from the reference site. |
| `/setting`, `/lore`, `/history`, `/pantheon`, `/territories`, `/gazetteer`, `/bestiary`, `/world`, `/maps-of-myrdae` | Doorway pages that point back to canonical KB material. |
| `/previous-campaigns` | Archive doorway to KB and legacy site. |

## API Endpoints

| Endpoint | Method | Purpose |
|---|---:|---|
| `/api/calendar/events` | GET | Reads the public Google Calendar ICS feed and returns upcoming events. |

## Removed Responsibilities

- No local database.
- No Prisma schema, seed script, or SQLite deployment state.
- No Google sign-in.
- No Google Docs sync.
- No local campaign/session/character CRUD.
- No local copy of Myrdae canon.

## Key Files

- Portal link config: `apps/web/lib/portal.ts`
- Reusable portal card page: `apps/web/components/portal/PortalPage.tsx`
- Calendar integration: `apps/web/lib/calendar.ts`
- Calendar page: `apps/web/app/(site)/calendar/page.tsx`
- Navigation: `apps/web/components/layout/Navbar.tsx`
- Windows setup: `scripts/setup-windows.md`
- Windows deploy script: `scripts/deploy-windows.ps1`

## Useful Commands

From repo root:

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```
