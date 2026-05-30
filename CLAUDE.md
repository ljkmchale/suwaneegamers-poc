# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Site Is

Suwanee Gamers is a **fantasy-themed portal** for a tabletop RPG group. It is a lightweight doorway — not a data store. All canonical campaign lore, characters, and session history lives at `http://kb.suwaneegamers.net`. The site surfaces the group calendar, campaign roster, DM/player profiles, and links to external tools.

Reference source for content decisions: `https://sites.google.com/view/suwanee-gamers/home`

---

## Commands

All commands run from the **repo root** unless noted.

```bash
# Development
pnpm dev            # starts Next.js on port 4652

# Quality
pnpm lint           # ESLint across app/, components/, lib/, __tests__/
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run (all tests, no watch)

# Single test file
cd apps/web && npx vitest run __tests__/pageBlocks.test.ts

# Watch mode
cd apps/web && npx vitest

# Build
pnpm build
```

Environment variable required for production: `ADMIN_SESSION_SECRET` (32+ char string). Without it the dev fallback is used.

---

## Monorepo Layout

```
/
├── content/              # All mutable site data (JSON files, images/)
│   ├── page-layouts.json # Block layouts for every editable page
│   ├── campaigns.json    # Campaign records
│   ├── players.json
│   ├── dungeon-masters.json
│   ├── bestiary.json
│   ├── nav.json          # Navigation config
│   ├── portal-links.json
│   ├── pages.json        # Custom page registry
│   └── theme.json        # Design token overrides
├── apps/web/             # Next.js 16 app (the only workspace package)
└── docs/                 # Human-facing reference docs
```

`content/` is co-located with the server process and read directly off disk via `lib/contentFiles.ts`. There is no database.

---

## Application Architecture

### Route Groups

- `app/(site)/` — public-facing site under the fantasy layout (Navbar + Footer + `pt-16` main for fixed nav)
- `app/admin/` — password-protected admin panel; gated by `proxy.ts` (Next.js proxy convention replacing middleware)
- `app/api/` — three API routes: `GET /api/page-layout`, `GET /api/media`, `GET /api/calendar/events`

### The Page Block System

Every editable page is a **flat ordered list of `PageItem`** values stored in `content/page-layouts.json`. A `PageItem` is either a `SectionItem` (references a named React component baked into the page) or a `BlockItem` (a portable asset block with typed props).

Key files:

| File | Role |
|---|---|
| `lib/pageBlocks.ts` | `BlockType` union, `AssetTypeDef` registry (`ASSET_TYPES`), prop schemas, field definitions. No fs calls — client-safe. |
| `lib/pageLayouts.ts` | Reads/writes `content/page-layouts.json`. Server-only. |
| `lib/pageSections.ts` | Static registry of named sections per page (the slots that section-based pages expose). Client-safe. |
| `components/blocks/BlockRenderer.tsx` | Renders any `BlockItem` given its type and props. Server component. |
| `components/blocks/PageBlockList.tsx` | Renders an entire `PageItem[]`, threading sections and blocks through a page-level CSS grid. |

**Two page patterns exist:**

1. **Section pages** (home, campaigns, players, DMs, bestiary) — define named React section components in the page file and pass them as `sections` to `PageBlockList`. Blocks are interleaved with named sections via `pageSections.ts`.

2. **Block-only pages** (lore, world, gazetteer, territories, etc.) — call `getPageLayout` and render `<PageBlockList items={order} grid={grid} />` directly. No baked-in sections.

Custom pages (`/[...slug]`) always use the block-only pattern, driven by `content/pages.json`.

### The Visual Editor (Admin)

When an admin enables edit mode, `PageEditOverlay` is injected into the site layout. It layers over the live page with:

- `PageDragLayer` — fixed-position transparent overlay that measures block DOM positions and renders drag handles + drop zones
- `PageEditPanel` — fixed right-side panel (288px) with the asset library ("Layout" and "Content" categories) and a props form for the selected block
- `DraftPagePreview` — re-renders the page items inline as editable previews

Block changes are persisted via the `savePageLayoutAction` server action (`app/admin/page-layout/actions.ts`), which calls `setPageLayout()` to write `content/page-layouts.json`.

**Adding a new block type:**

1. Add the type literal to `BlockType` in `lib/pageBlocks.ts`
2. Add an `AssetTypeDef` entry to `ASSET_TYPES` (category: `"content"` or `"layout"`, fields, defaultProps)
3. Add a render case in `BlockRenderer.tsx`
4. Add an editor preview case in the `DraftBlock` function in `PageEditOverlay.tsx`
5. Update `ALL_BLOCK_TYPES` in `__tests__/pageBlocks.test.ts`

### Content Data Layer

All content reads go through `lib/contentFiles.ts` (`readContent<T>` / `writeContent`). Each domain has its own lib file:

- `lib/campaigns.ts` — reads `campaigns.json`, exports `listedCampaigns`, `sideCampaigns`, `findCampaign`
- `lib/players.ts` — reads `players.json`
- `lib/dungeonMasters.ts` — reads `dungeon-masters.json`
- `lib/bestiary.ts` — reads `bestiary.json`
- `lib/nav.ts` — reads `nav.json` with hardcoded default fallback
- `lib/portal.ts` — reads `portal-links.json`
- `lib/customPages.ts` — reads/writes `pages.json`

All admin mutations go through server actions in `app/admin/[domain]/actions.ts`.

### Auth / Session

`proxy.ts` (Next.js 16 proxy convention) guards all `/admin/*` routes via iron-session. The session cookie is `sg-admin`. `lib/adminSession.ts` exports `getAdminSession()` for use in server components and actions.

Edit mode is a separate session flag (`editMode`). An admin can be logged in without edit mode active — edit mode enables the `PageEditOverlay`.

### Styling

Design tokens are CSS custom properties defined in `app/globals.css`:

```
--color-bg-deep / --color-bg-surface / --color-bg-card / --color-bg-border
--color-text-primary / --color-text-secondary / --color-text-muted
--color-accent-arcane (#8b5cf6) / --color-accent-gold / --color-accent-blood / --color-accent-ice
```

The site uses Tailwind 4 for utility classes alongside these tokens. Block components reference tokens via `style={{ color: "var(--color-accent-arcane)" }}` for dynamic theming. The `fantasy-card` utility class is defined in globals.css.

**Nav height is `h-16` (64px) and fixed.** The `<main>` in `app/(site)/layout.tsx` has `pt-16` to push page content below it. Block components should not add their own nav-compensation padding.

### Tests

Vitest with jsdom. Nine test files in `apps/web/__tests__/`, each covering one lib module. The `pageBlocks.test.ts` file maintains `ALL_BLOCK_TYPES` — keep it in sync when adding or removing block types.

---

## Key Invariants

- **`lib/pageBlocks.ts` must stay fs-free** — it is imported by client components (the editor panel). Any file I/O belongs in `lib/pageLayouts.ts` or `lib/contentFiles.ts`.
- **Legacy data-block types** (`campaigns-grid`, `players-grid`, `dms-grid`, `bestiary-grid`, `campaign-card`, `player-card`, `creature-card`, `calendar-embed`) remain in the `BlockType` union and `BlockRenderer` for backwards compatibility with saved pages, but have no `ASSET_TYPES` entry and cannot be added via the editor. They are being migrated to individual block assets.
- **Block alignment logic** that exists in both `BlockRenderer.tsx` and `PageEditOverlay.tsx` (`DraftBlock`) must be kept in sync — the editor preview is a hand-rolled duplicate of the live renderer.
- **The `content/` directory is the source of truth.** `page-layouts.json` is written by the editor; all other JSON files are written by admin CRUD actions. Never write to `content/` from client code.
