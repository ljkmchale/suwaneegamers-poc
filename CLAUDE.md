# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory Architecture Preflight

Before changing paths, content, images, audio/video, synchronization, voice,
builds, or deployment, read `docs/AI_ARCHITECTURE.md` and run
`pnpm arch:preflight`. Trace every writer, including scheduled scripts, and run
the preflight again after editing.

## What This Site Is

Suwanee Gamers is a **fantasy-themed portal** for a tabletop RPG group. It is a lightweight doorway — not a data store. All canonical campaign lore, characters, and session history lives at `http://kb.suwaneegamers.net`. The site surfaces the group calendar, campaign roster, DM/player profiles, and links to external tools.

Reference source for content decisions: `https://sites.google.com/view/suwanee-gamers/home`

---

## Commands

All commands run from the **repo root** unless noted.

```bash
# Development
pnpm dev            # starts Next.js on localhost:3000

# Quality
pnpm lint           # ESLint across app/, components/, lib/, __tests__/
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run (all tests, no watch)

# Single test file
cd apps/web && npx vitest run __tests__/pageBlocks.test.ts

# Watch mode
cd apps/web && npx vitest

# Build
pnpm build          # builds the normal .next folder
pnpm --filter web build:prod  # builds the production .next-prod folder
```

Environment variable required for production: `ADMIN_SESSION_SECRET` (32+ char string). Without it the dev fallback is used.

### Local and Production Servers

- Dev server: `pnpm dev`, `http://localhost:3000`, normal `.next`.
- Production service: Windows NSSM service `SuwaneeGamers`, port `4652`, serves from `apps/web/.next-prod`.
- Production build: run `pnpm --filter web build:prod` or `scripts/deploy-prod.ps1`. A plain `pnpm build` updates `.next` only and will not change production.
- Production restart requires elevation: `C:\EaselLocal\nssm.exe restart SuwaneeGamers`.
- If a code/UI change appears in dev but not production, check that `.next-prod` was rebuilt and the NSSM service restarted.
- If content JSON changes do not appear, check the SQLite `content_documents` row as well as the file.

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
│   ├── lib/brain/        # Chronicles RAG engine (query, embeddings, vector store) — runs in-process
│   ├── brain-vault/      # Chronicles content: wiki/, raw/, processed/ — see its own CLAUDE.md
│   ├── brain-tools/      # Standalone CLI scripts that maintain brain-vault/ (indexer, ingest helpers, audits)
│   └── brain-data/       # Generated: brain-index.json, query cache, logs (gitignored)
└── docs/                 # Human-facing reference docs
```

`content/` is co-located with the server process, but runtime reads go through `lib/contentFiles.ts`, which prefers the SQLite `content_documents` table in `content/suwaneegamers.db` before falling back to JSON files. `writeContent()` writes both the DB row and the JSON file. If you manually edit JSON, sync or update the DB row too, or the running app may keep showing the old value.

Useful sync commands:

```bash
pnpm content:sync-documents  # copy content/*.json and content/page-layouts/*.json into content_documents
pnpm content:scheduler:once  # run due scheduled content jobs once
pnpm content:sync-all        # run all scheduler jobs once
```

### Image Optimization

Site images live in `apps/web/media/images/` and are served raw (many blocks use CSS `background-image`, which bypasses `next/image`), so files must be small on disk. Two mechanisms keep them that way:

- **Drive-sync scripts** (`sync-gazetteer-entries`, `sync-pantheon-symbols`, `sync-organization-symbols`, `sync-campaign-headers`, `sync-dm-reference`) re-encode downloads as WebP (quality 80, longest side ≤1920px) via `scripts/lib-image-cache.mjs`. Each image directory keeps a `.drive-cache.json` manifest recording the upstream Drive size per file so unchanged files are not re-downloaded (local sizes can't be compared to Drive's after re-encoding).
- **`pnpm images:optimize`** (`scripts/optimize-images.mjs`) is the batch pass for images added by other routes: converts PNG/JPG >150KB to WebP, recompresses oversized WebP in place, and rewrites references in `content/` and `apps/web` source. It does NOT touch the SQLite relational tables (campaigns, gazetteer, etc.) — check those manually if it renames files, and run `pnpm content:sync-documents` afterwards.

Do not commit multi-megabyte originals; `/images/suwaneegamers-logo.png` intentionally stays PNG (apple-touch-icon).

### Source-Managed / Chronicles Notes

`/admin/source-managed` reads `content/auto-managed-pages.json` through `lib/contentFiles.ts`, so remember the DB-first rule above. If the JSON file is correct but the admin UI is stale, inspect `content_documents.path = 'auto-managed-pages.json'` in `content/suwaneegamers.db`.

`/chronicles` is a Brain Vault page. Its managed source rows should mirror `apps/web/brain-tools/google-doc-sources.json`; the scheduler job id is `chronicles-sources`, which runs `apps/web/brain-tools/src/refresh-sources.mjs`. Public `/chronicles` is player-safe; `/admin/chronicles` can expose DM-visible sources behind admin auth.

### Chronicles / Brain Vault

Chronicles (`/chronicles`, `/admin/chronicles`) is a RAG-backed wiki for the group's D&D campaigns, fully embedded in this app — no separate server. `lib/brain/` holds the TypeScript query engine; `brain-vault/` holds the actual Markdown content it answers questions from. See [apps/web/brain-vault/CLAUDE.md](apps/web/brain-vault/CLAUDE.md) for vault conventions (campaign isolation, wiki structure, ingest workflow). `brain-tools/` contains the indexer and CLI scripts (`npm run index`, `npm run pull-doc`, `npm run mark-processed`, etc.) used to maintain the vault and rebuild `brain-data/brain-index.json`.

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

**The whole site is members-only.** `proxy.ts` also requires a Google sign-in session (`sg-user`) for every page and API route, redirecting browsers to `/signin?from=…` and returning 401 to API callers. Exceptions are listed in `PUBLIC_PATHS` (the gate and the OAuth round trip) and `MACHINE_PATHS` (callers with their own bearer secret: LiveKit metrics/analytics, the content scheduler). Enforcement is skipped entirely when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are absent, so a server without OAuth configured cannot lock everyone out.

This gate **must** stay in the proxy. The `(site)` layout also renders `SignInGate`, but that alone is not protection: React renders the layout and the page in parallel, so a layout that swaps in the gate still streams the page's rendered RSC payload in the same HTML — `curl /campaigns` returned every campaign name before the proxy gate existed. Never move an authorization check from the proxy into a layout.

`lib/authRedirect.ts` holds `safeReturnPath()`, the open-redirect guard for the post-sign-in destination; the path rides through Google in the short-lived `sg-oauth-from` cookie. Note that `proxy.ts`'s matcher excludes `images/`, `media/`, and `fonts/`, so static asset URLs remain fetchable by anyone who knows them.

### The Home-Page Voice Assistant

The mic button on the home page is a LiveKit voice agent (`services/livekit-schedule-agent/`, Claude Haiku for thinking + local Speaches for speech). `POST /api/livekit/token` builds the dispatch metadata: a live calendar snapshot (`events`) **and** a `knowledge` string — the contents of `content/assistant-brain.md`, read via `lib/assistantBrain.ts`.

`assistant-brain.md` is the assistant's **knowledge base** (a Karpathy-style "LLM wiki"): a compact, curated Markdown doc about the group, campaigns, DMs, and links. The prose outside the `<!-- AUTO:BEGIN -->` / `<!-- AUTO:END -->` markers is hand-editable; the block between them is regenerated from `campaigns.json`, `dungeon-masters.json`, and `portal-links.json` by `scripts/build-assistant-brain.mjs` (`pnpm content:build-assistant-brain`, also the daily `assistant-brain` scheduler job).

In `agent.py`, schedule questions are still answered deterministically for speed; other questions fall through to the language model, grounded on the knowledge base injected into its instructions. Keep the brain small — it rides in dispatch metadata every session.

**Page context.** Myra knows which page the visitor is on. The path + document title ride in the token request at connect time (`sanitizePageContext` in the token route validates them as internal absolute paths), and every later navigation is published to the `myra.page_context` data-channel topic by `AssistantRoom`. The agent renders this into a trailing prompt block via `page_context_block()` and swaps it with `update_instructions()` — so "tell me about this" resolves against what's on screen, including right after Myra opens a page herself. It is text-only: she gets the page's name and address, never its pixels, and the prompt explicitly forbids implying otherwise. Browser-supplied text is bounded on both sides.

Each answer records which model served it in `voice_questions.model` (`claude`, or null for deterministic; older rows may hold the retired local model's name), so LLM vs deterministic answers are distinguishable rather than looking identical under `response_mode = 'llm'`.

`build_llm()` returns a bare **Claude Haiku 4.5** LLM — the sole thinking engine (the local model fallback was removed). Haiku's job is one decision: when to call `search_knowledge_base`. Set `ANTHROPIC_API_KEY` in `.env.local` (service dir or repo root; both are loaded by absolute path); **with no key set, `build_llm()` raises** — there is no local floor anymore, and an API outage degrades Myra to deterministic answers only (schedule, recap, navigation, learned). A stalled Claude call is bounded by the session's `conn_options` (`SessionConnectOptions(llm_conn_options=APIConnectOptions(timeout=ANTHROPIC_ATTEMPT_TIMEOUT, max_retry=ANTHROPIC_MAX_RETRY))`) so a hung request fails fast instead of stacking framework retries. Haiku is deliberate: it is the one current Claude model that still accepts `temperature` (set via `ANTHROPIC_TEMPERATURE`), which Sonnet 5 and Opus 5 reject with a 400.

#### Personas (per-member voice and manner)

A **persona** changes only how Myra sounds and talks — never who she is, what she knows, or her grounding rules. Personas live in `content/assistant-personas.json`:

| Piece | Role |
|---|---|
| `lib/assistantPersonas.ts` | Pure logic: types, `VOICE_OPTIONS` (Kokoro voices the local Speaches server serves), `clampPersona`/`clampPersonaCatalog`, `resolvePersona`. No fs — unit-tested. |
| `lib/assistantPersonaStore.ts` | DB-first read/write of `assistant-personas.json`, plus `personaForAgentMember()`. |
| `user_profiles.myra_persona` | A member's explicit choice, written by `/profile` (member) or `/admin/voice-assistant` (admin). Last write wins. |

Resolution order is **explicit choice → `matchPlayers` roster match → `defaultPersonaId`**, so someone can have the right voice before they ever sign in (that is how "Michael Hewson" gets the British persona). The token route ships the resolved persona in dispatch metadata; `agent.py` uses `voice`/`speed` for the Kokoro TTS and renders `style` + `examples` into the "Spoken personality" section of the system prompt. `PERSONA_INVARIANTS` in `agent.py` are the ceiling every persona inherits (accuracy over character, no profanity, no SSML/stage directions) and are not editable per persona.

The admin panel lists **both** signed-in members and roster players who have never signed in. The two rows save differently: a member's choice goes to `user_profiles.myra_persona`, while a roster player's goes into that persona's `matchPlayers` (there is no profile row to write yet). `/api/admin/voice-preview` auditions a voice — admin-gated, and it accepts only a voice id plus an optional persona id, never free text, so it cannot become an open text-to-speech endpoint.

**Kokoro is the prosody ceiling.** An 82M model has almost no expressive range, so *what* a persona says carries the personality, not how it is delivered. Comma-linked clauses read with shape; clipped fragments come out flat — persona `style` lines should say so. If a persona ever needs real delivery control, the installed `openai.TTS` plugin accepts an `instructions` string that `gpt-4o-mini-tts` performs.

Adding a persona means editing the JSON (then `pnpm content:sync-documents`) — the voice must be one of `VOICE_IDS`, or it silently falls back to the default. Changes to `agent.py` require restarting the voice stack (scheduled task `SuwaneeGamersVoiceStack`); changes to personas alone take effect on the next voice session.

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
