# CLAUDE.md

This file provides guidance to Claude Code when working inside `brain-vault/`.

## What This Is

An Obsidian-style vault functioning as an LLM-maintained wiki for a D&D campaign group. No code, no build system — the entire "codebase" is Markdown. It tracks active campaigns: **HoE** (Heroes of Emberstran), **SoD** (Souls of Destiny), **The Silent Vanguard**, **Bloody Endeavor**, **Dungeons III**, and **The Crystal Bottle**.

This vault is consumed by the Chronicles RAG engine at `apps/web/lib/brain/` (query, embeddings, indexing logic) and indexed/maintained by the standalone CLI tools in the sibling `apps/web/brain-tools/` directory. Chronicles itself is part of the Suwanee Gamers Next.js app — see the root [CLAUDE.md](../../../CLAUDE.md) for that side of the system.

## Three-Layer Architecture

1. **`raw/`** — Immutable source documents (player notes, Google Doc exports). Read only; never modify. Backend only — not visible to users.
2. **`processed/`** — Small JSON receipts that record which raw source hash has been ingested into `wiki/`. Backend only — not visible to users.
3. **`wiki/`** — LLM-owned Markdown pages. All writing happens here. This is the only layer users interact with (via the Chronicles UI at `/chronicles` and `/admin/chronicles`).
4. **`AGENTS.md`** — Schema and workflow spec. Update it when conventions change. Backend only.

When answering user questions, only surface content from `wiki/`. Never reference `raw/`, `processed/`, `brain-tools/`, or technical config files in responses — users should only see campaign and D&D information.

## Core Operations

**Ingest** (new source added to `raw/`): Read source → create/update `wiki/summaries/` page → update entity/concept/overview/synthesis pages → add cross-references → update `index.md` → append to `log.md` → mark the source processed from `brain-tools/` with `npm run mark-processed -- --filename "<raw-file.md>" --pages "<wiki/page.md,wiki/other.md>"`.

Google Docs sources can be pulled into `raw/` from the admin Chronicles UI (`/admin/chronicles`, which calls `pullGoogleDocToRaw` directly), or from `brain-tools/` with `npm run pull-doc -- --url "<Google Doc URL>" --title "<Source Title>" --filename "<file-name>.md"`. The Doc must be link-viewable. After pulling, still run the Ingest workflow to make the material durable and searchable through `wiki/`.

Reindexing (rebuilding `brain-data/brain-index.json` from `wiki/`) is triggered from `/admin/chronicles` (spawns `brain-tools/src/indexer.mjs`) or manually with `npm run index` from `brain-tools/`.

**Query**: Read `index.md` first → read relevant wiki pages → synthesize → if the answer produces durable knowledge, create or update a wiki page → update `index.md` and `log.md` if wiki changed.

**Lint**: Check for contradictions, stale claims, orphan pages, missing cross-references, undocumented concepts. Record lint passes in `log.md`.

## Wiki Structure

| Path | Contents |
|---|---|
| `wiki/world/` | World-level canon: Oberra (planet), Myrdae (continent) |
| `wiki/world/locations/` | Canonical geography — what a place *is* (sourced from DM world docs) |
| `wiki/world/gods/` | Individual deity deep-dives (master index: Pantheon of Myrdae concept page) |
| `wiki/summaries/` | One page per source document |
| `wiki/sessions/<Campaign>/` | One page per play session |
| `wiki/entities/` | Player characters (scoped per campaign) |
| `wiki/npcs/<Campaign>/` | NPCs per campaign |
| `wiki/factions/<Campaign>/` | Factions per campaign |
| `wiki/locations/<Campaign>/` | What the party has *experienced* at a location (campaign-scoped) |
| `wiki/items/<Campaign>/` | Items and artifacts per campaign |
| `wiki/timelines/` | Chronological session maps per campaign |
| `wiki/indexes/` | Cross-campaign reference indexes (NPC, Quest, Locations, Factions, Items) |
| `wiki/maps/<Campaign>/` | Relationship maps, clue-to-thread maps, character beat matrices |
| `wiki/threads/` | Open unresolved threads grouped by campaign |

## World vs Campaign Scope

`wiki/world/` is **campaign-agnostic**. A world location page (e.g., `wiki/world/locations/Adsuren.md`) describes the canonical geography, history, factions, and layout of a place regardless of what any party has done there. It is sourced from DM world-building documents.

`wiki/locations/<Campaign>/` pages describe what a **specific party** has experienced, discovered, or changed at a location. These pages reference world pages but are scoped to one campaign.

When a location appears in multiple campaigns, it gets one world page and separate campaign-scoped pages. Never put campaign-specific plot events in a world page.

## Navigation Entry Points

- `index.md` — content-oriented catalog, the first file to read on any query
- `wiki/overview.md` — high-level map of what the wiki currently knows
- `wiki/synthesis.md` — cross-source synthesis (update when multi-source patterns emerge)
- `log.md` — chronological change history

## Critical Convention: Campaign Scope Isolation

**Never bleed information across campaigns.** Characters, NPCs, items, locations, and plot threads are scoped to their campaign. HoE and SoD both have a character named Lesley Poole, but Ky'tha (HoE) and Esylla (SoD) are separate entities with separate pages. Lila and Zephyra are SoD-only characters unless a future source explicitly proves a separate character in another campaign. Always check the campaign scope before writing cross-references.

## Player Roster

**HoE**: Ainslie (Sean Poole), Aurelius (Larry/Lawrence McHale), Hap (Ty Cooper), Ky'tha (Lesley Poole), Og (Joshua John), Zymve (Emma Cooper).

**SoD**: Escanor (Brian Winniford), Esylla (Lesley Poole), Kenton (Larry/Lawrence McHale), Lila (Tiffany), Therric (Chip Poole), Zephyra (Jenny McHale).

**The Silent Vanguard**: Jett Blackwood (Larry/Lawrence McHale, Human Fighter), Axel Blackwood (Larry/Lawrence McHale), Cletus (Brian, Human Cleric), Lensworth/"Lenny" (Tom, Human Barbarian).

**The Crystal Bottle**: Scarlytt Amyran (Lesley Poole, Elf Paladin), Sigil (Brian Winniford, Half-Orc Fighter), Yvaine (Jenny McHale, Human Mage/Warlock), Ren (Tiffany, Ranger), Narris (Chip Poole, Bladesinger), Tassarion Ranges (Sean Poole, Elf Cleric — deceased Session 6.1), Galtrelon (Sean Poole, Elf Archdruid — replaced Tass Session 6.3), Alteya (Emma Cooper). Former members: Dalbyre Bramblesage (Chip Poole, Elf Bard — Sessions 0–5.1, left farewell letter at Tal'basar before the battle), Opal Creekbed (Human Paladin — departed Session 2.1).

**Dungeons III**: Player roster not yet ingested.

## log.md Format

```
## [YYYY-MM-DD] <type> | <short title>

- Bullet describing what changed.
```

Types: `setup`, `source`, `note`, `synthesis`, `correction`, `structure`, `clarification`, `lint`, `query`.

## Obsidian Cross-References

Internal links use `[[Page Name]]` syntax. Use this consistently when linking between wiki pages. File names must match exactly (case-sensitive on some systems).
