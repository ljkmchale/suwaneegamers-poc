# Suwanee Gamers Website Inventory

Last reviewed: 2026-06-10

A complete map of the site: every route, content file, page layout, block type, and image asset. Read this before making changes — it tells you where everything lives and which file to edit.

## What This Website Is

Suwanee Gamers is a fantasy-themed portal for a tabletop RPG group. It is a lightweight doorway — not a data store. Canonical campaign lore lives at `http://kb.suwaneegamers.net` (the "Chronicles"). The legacy Google Site at `https://sites.google.com/view/suwanee-gamers/home` is the migration/reference source for content decisions.

- Live site: **www.suwaneegamers.net** (Cloudflare Tunnel → NSSM service on port 4652)
- Dev server: `pnpm dev` → **localhost:3000**
- Calendar source: `g3kgagicusaol82fqhjc62o47o@group.calendar.google.com`

## Technology Stack

- Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4
- `iron-session` admin auth (cookie `sg-admin`, gated by `proxy.ts`)
- Vitest 3 + jsdom (≈539 tests in `apps/web/__tests__/`)
- No database — all data is JSON files in `content/`, read off disk at request time
- Deploy: `next build`, then restart the `SuwaneeGamers` NSSM service (see `/deploy` skill / memory)

## Routes

### Public pages — `apps/web/app/(site)/`

| Route | Pattern | Layout file |
|---|---|---|
| `/` | sections (hero, portal) | `content/page-layouts/home.json` |
| `/calendar` | hardcoded page (embed + ICS event list) | — |
| `/campaigns` | sections (header, side-label) + blocks. Active campaign cards, "Other Campaign Tools", then divider + **Previous Campaigns archive** (merged 2026-06-10) | `campaigns.json` |
| `/campaigns/[id]` | block-only; saved layout per campaign, falls back to `buildCampaignDetailLayout()` | `campaigns/<id>.json` |
| `/players` | sections (header, unassigned) + player cards | `players.json` |
| `/dungeon-masters` | section (header) + profile cards | `dungeon-masters.json` |
| `/bestiary` | section (header) + creature cards | `bestiary.json` |
| `/pantheon` | block-only; 29 deity cards | `pantheon.json` |
| `/history` | block-only; timeline + fold-headers | `history.json` |
| `/organizations` | block-only; 23 org cards in grids | `organizations.json` |
| `/references` | block-only; sourcebook/tool cards | `references.json` |
| `/territories` | block-only; 9 layout-cards | `territories.json` |
| `/maps-of-myrdae` | block-only; map layout-cards | `maps-of-myrdae.json` |
| `/gazetteer` | block-only; 4 layout-cards | `gazetteer.json` |
| `/campaign-setting` | block-only; reference-card layout-cards | `campaign-setting.json` |
| `/reference-for-dungeon-masters` | block-only; reference-card layout-cards | `reference-for-dungeon-masters.json` |
| `/lore`, `/world`, `/setting` | block-only doorway pages (page-header + portal-links) | matching `.json` |
| `/previous-campaigns` | standalone archive page — content now ALSO lives on `/campaigns`; no longer in nav, but kept because archive cards link to its detail pages | `previous-campaigns.json` |
| `/previous-campaigns/[id]` | archived campaign detail (driven by `archived-campaign-card` props via `lib/archivedCampaigns.ts`) | — |
| `/test-page` | empty scratch page (still in nav under Toolset) | `test-page.json` |
| `/[...slug]` | catch-all for custom pages registered in `content/pages.json` (currently empty `[]`) | — |

### Admin — `apps/web/app/admin/`

`/admin` (dashboard), `/admin/login`, `/admin/pages` (+ `/new`), `/admin/page-layout`, `/admin/media`, `/admin/appearance`. Server actions in `app/admin/*/actions.ts` (login, pages, page-layout, media, appearance). Domain CRUD (campaigns/players/DMs/bestiary) is edited via the visual editor and content files.

### API

`GET /api/page-layout`, `GET /api/media`, `GET /api/calendar/events`.

## Content Data Files — `content/`

| File | Records | Shape (top-level keys per record) |
|---|---|---|
| `campaigns.json` | 8 active/side campaigns | `id, name, dm, schedule, referenceUrl, headerImage, resources[], party[], description, sessionSummaries[]` — sessionSummaries: `{title, summary, audioLinks[{label,url}]}`. All summaries fully populated as of 2026-06-10 (imported from the Google Site). |
| `players.json` | 16 | `id, name, description` |
| `dungeon-masters.json` | 6 | `id, name, focus, description, portrait, activeCampaignIds, previousCampaigns` |
| `bestiary.json` | 12 | `name, type, image, href` |
| `nav.json` | 4 sections | Primary (Calendar, Campaigns, DMs, Chronicles), Setting (History, Land, Organizations, Pantheon, References, Maps, Interactive Map), Tools (empty), Toolset (Campaign Setting, DM Reference, Gazetteer, Bestiary, Lore, Territories, Test Page). "Previous Campaigns" removed 2026-06-10. |
| `portal-links.json` | 3 | Open Chronicles, View Calendar, Open D&D Beyond |
| `pages.json` | `[]` | custom page registry (empty) |
| `theme.json` | — | color tokens, surfaces, glowIntensity, particles, fonts (Cinzel/Lora), siteName, siteTagline |
| `page-layouts/` | one JSON per page | per-page block layouts (see Routes table). `page-layouts.json` at content root is the **legacy fallback** — per-page files in `page-layouts/` win. |

Known data quirks:
- `nav.json` has a "Land" item pointing to `/land`, which is **not a registered route** — this is the one failing test in `contentIntegrity.test.ts` ("every internal nav href is a registered app route").
- Campaign detail saved layouts (`page-layouts/campaigns/*.json`) are **denormalized snapshots** of `campaigns.json` — session summaries, rosters, and resources exist in BOTH places. Editing `campaigns.json` does NOT update a saved layout; either edit both or delete the saved layout so `buildCampaignDetailLayout()` regenerates it.

## Block System

Defined in `apps/web/lib/pageBlocks.ts` (client-safe, no fs). Rendered by `components/blocks/BlockRenderer.tsx`; page assembly by `PageBlockList.tsx`; editor preview duplicated in `components/admin/PageEditOverlay.tsx` (`DraftBlock` — keep in sync with BlockRenderer).

### Editor-addable block types (`ASSET_TYPES`)

- **layout**: `page-header`, `page-banner`, `portal-links`, `card-grid`, `grid-section`
- **content**: `divider`, `card`, `image`, `section-heading`, `fold-header`, `timeline`, `button-link`, `link-list`, `gallery`, `embed`, `text`, `callout`, `spacer`, `quote`, `campaign-hero`, `campaign-meta`, `campaign-links`, `campaign-notes`, `campaign-roster`, `campaign-sessions`, `archived-campaign-card`, `media-player`, `deity-card`, `profile-card`, `layout-card`

### Legacy types (render but cannot be added in editor)

`campaigns-grid`, `players-grid`, `dms-grid`, `bestiary-grid`, `campaign-card`, `player-card`, `creature-card`, `calendar-embed` — still used in saved layouts (e.g. `campaign-card` on /campaigns, `player-card` on /players, `creature-card` on /bestiary).

### Nested item vocabularies

- `profile-card` items: portrait, image, heading, eyebrow, description, stat, character-count, badge, link, divider, item-list, character-list, next-session, campaign-info
- `layout-card` / `grid-section` items (`CardLayoutItem`): grid, header, text, link, audio-link, media-player, inner-card, image, divider, person — stored as **JSON-in-a-string** in `props.items`, nested grids are double-encoded. `CARD_LAYOUT_MAX_ROWS = 120`.

`card-grid` works by grouping: in a page layout, a `card-grid` block swallows all *consecutive following* blocks whose type is in `isGridChild()` (profile-card, layout-card, card, campaign-card, archived-campaign-card, deity-card, player-card, creature-card) — see `PageBlockList.tsx`.

### Adding a new block type (5 steps)

1. `BlockType` union in `lib/pageBlocks.ts` → 2. `ASSET_TYPES` entry → 3. render case in `BlockRenderer.tsx` → 4. `DraftBlock` preview case in `PageEditOverlay.tsx` → 5. `ALL_BLOCK_TYPES` in `__tests__/pageBlocks.test.ts`.

## Image Assets — `apps/web/public/images/`

All paths below are referenced from content JSON as `/images/...`.

| Directory | Count | Used by |
|---|---|---|
| (root) | 18 | DM/player portraits (`chip-poole.png`, `larry-mchale.png`, `*-clean.webp` …), dragon icons (`bronze/copper/silver-dragon.png`), `suwaneegamers-logo.png`, `dragon-ears.png` (audio-player button art on campaign session recordings), `suwanee-media-player-test.wav` |
| `campaigns/` | 8 | Active campaign header images, one per campaign id (`a-new-adventure.jpg` … `the-silent-vanguard.jpg`) |
| `campaigns/archive/` | 11 | Archived campaign card images (beer-and-dice, call-for-heroes, crystal-bottle, imminent-domain, legends-of-larch, mead-society, middle-earth, obliged-corpses, storm-kings-thunder, strahd-avernus, the-company) |
| `bestiary/` | 12 | Creature portraits (bulas, chalyth, dralg, genling, gertot, giant-solifugid, kahlbit, leatherback, narun, rongri, saber, thall-mound) |
| `pantheon/` | 29 | Deity portraits, one per deity-card on /pantheon (addan … voegurn) |
| `organizations/` | 32 | Org art in three naming tiers: `detail-*` (9, full art), `marked-generated-*` (11, generated placeholders), `table-*` (12, table-row art) |
| `gazetteer/cities/` | 46 | City/settlement images used by /gazetteer layout-cards |
| `maps-of-myrdae/` | 13 | Region maps (`clean-map`, `grid-map`, `hex-map`, `locations-map`, `pre-awakening-map`, `territories-map` .webp) + **7 orphaned untracked "ChatGPT Image …" PNGs** (referenced nowhere as of 2026-06-10 — candidates for renaming or deletion) |
| `maps-of-myrdae/territories/` | 45 | Individual territory silhouettes (aelbon … yearning .webp), used on /territories |
| `guides-to-myrdae/` | 2 | Cover art for campaign-setting and dm-reference |
| `guides-to-myrdae/reference-cards/` | 19 | Reference card images: `campaign-setting-*` (11) for /campaign-setting, `dm-reference-*` (8) for /reference-for-dungeon-masters |
| `references-sourcebooks/` | 15 | `adventure-*` (6) and `tool-*` (8) card images + overview, for /references |
| `generated/` | 15 | Derived variants: `*-card.webp` DM cards, `*-desktop/portrait/wide.webp` dragon banners (built by `scripts/prepare-images.mjs`) |

Conventions: webp preferred; kebab-case names matching the content id/slug they belong to. Media uploads via `/admin/media` land in `public/images/`.

## Styling / Theme

Design tokens are CSS custom properties in `app/globals.css`, overridable via `content/theme.json` (admin → Appearance):
`--color-bg-deep/surface/card/border`, `--color-text-primary/secondary/muted`, `--color-accent-arcane (#8b5cf6) /gold (#f59e0b) /blood /ice`, `--card-radius/blur/hover-border`. Fonts: Cinzel (headings), Lora (body). `fantasy-card` utility class. Nav is fixed `h-16`; `(site)` layout `<main>` has `pt-16`.

## Scripts — `scripts/`

- `prepare-images.mjs` — builds `public/images/generated/` variants
- `fill-session-summaries.mjs` — one-off (2026-06-10): imported session summaries from the Google Site into `campaigns.json` + the saved campaign layouts
- `setup-windows.md`, `deploy-windows.ps1` — Windows host setup/deploy

## Gotchas Checklist (before editing)

1. **Saved layouts override code.** If a page looks wrong, check its `content/page-layouts/*.json` before touching page components — most page content lives in those files, not in TSX.
2. **Campaign data is duplicated** between `campaigns.json` and `page-layouts/campaigns/*.json` (see above).
3. **`lib/pageBlocks.ts` must stay fs-free** (imported by client editor components).
4. **BlockRenderer ↔ PageEditOverlay DraftBlock** must stay in sync.
5. **Dev (3000) vs prod (4652)**: stop the dev server before `next build` (shared `.next`); production needs an NSSM service restart to pick up code (content JSON changes appear via `revalidate = 300` without redeploy).
6. **Known pre-existing test failure**: nav `/land` route (contentIntegrity.test.ts).
