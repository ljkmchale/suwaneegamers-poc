# LLM Wiki Schema

This vault follows Karpathy's LLM Wiki pattern.

## Architecture

There are three layers:

1. `raw/`
   - Curated source documents.
   - Immutable source of truth.
   - The LLM reads from this layer but does not modify it.

2. `processed/`
   - Small JSON receipts for raw sources that have already been ingested.
   - Tracks the raw source content hash, ingest status, processed timestamp, and pages updated.
   - A stale receipt means `raw/` has newer material that still needs wiki extraction.

3. `wiki/`
   - LLM-generated Markdown pages.
   - Summaries, entity pages, concept pages, comparisons, overview, and synthesis.
   - The LLM owns this layer: create pages, update pages, maintain cross-references, and keep consistency.

4. `AGENTS.md`
   - The schema file.
   - Explains the structure, conventions, and workflows for future LLM sessions.
   - Update this file as the workflow evolves.

## Operations

### UI Surface

`brain-query/` now runs as the Chronicles query API and indexing service. Its local `public/` UI is legacy/admin-only and is not the primary user interface. Player and DM-facing use should happen through the Suwanee Gamers site, where the Brain is integrated as the `Chronicles` page. Keep future UI work in `suwaneegamers-poc` unless the task is specifically about maintaining a fallback/debug surface inside `brain-query/`.

### Ingest

When a new source is added to `raw/`:

1. Read the source.
2. Create a summary page in `wiki/summaries/`.
3. Update relevant entity, concept, comparison, overview, or synthesis pages.
4. Add cross-references between related pages.
5. Note contradictions or changed understanding directly on affected pages.
6. **If the source contains session play for any player character, review that player's habit profile in `wiki/synthesis.md` under "Player Habit Profiles". Add new patterns if they emerge, strengthen existing ones with new evidence, or note if a player is contradicting an established pattern. Remove the "tentative" flag for single-campaign players once a second campaign's data is available.**
7. Update `index.md`.
8. Append an entry to `log.md`.
9. Mark the raw source processed from `brain-query/` with `npm run mark-processed -- --filename "<raw-file.md>" --pages "<wiki/page.md,wiki/other.md>"`.

Google Docs can be pulled into `raw/` from `brain-query/` with `npm run pull-doc -- --url "<Google Doc URL>" --title "<Source Title>" --filename "<file-name>.md"`. The Doc must allow anyone with the link to view it. The query service also auto-checks tracked docs from `brain-query/google-doc-sources.json` while the server is running and refreshes `raw/` only when a Doc's text hash changes. Pulling only updates the immutable source layer and `raw/_sources.md`; it does not replace the Ingest workflow above.

Raw overwrites are protected: before replacing a raw source, the app copies the previous file into `raw/.history/<source>/`, keeps recent backups, and refuses suspiciously small pulls.

Use `npm run processed-status` from `brain-query/` to see which raw sources are unprocessed or stale.

### Query

When answering a question:

1. Read `index.md`.
2. Search and read relevant wiki pages.
3. Do not use `log.md` as answer context or expose it through player-facing UI. The log is operational history for ingest/lint/workflow tracking, not campaign canon.
4. Synthesize an answer from the maintained wiki.
5. **Show your work.** For each claim or pattern in the answer, cite the specific source: the session page, entity page, or summary that supports it. Format as a brief inline reference (e.g. "Therric reads tracks and soil before committing — *SoD Session 03, Therric entity page*"). This lets the DM verify accuracy and catch hallucination. Do not state a pattern without a source anchor.
6. After answering, always evaluate whether the answer contains new facts, corrected understanding, or useful synthesis not yet in the wiki. Default to writing it back — create or update a wiki page unless the answer is purely ephemeral (e.g. a simple lookup of something already well-covered).
7. Update `index.md` and `log.md` whenever the wiki changes.

### Lint

Periodically check for:

- contradictions between pages
- stale claims
- orphan pages
- missing cross-references
- important concepts mentioned without pages
- data gaps that need new sources

Record lint passes in `log.md`.

## World Layer

`wiki/world/` holds campaign-agnostic canon for the planet **Oberra** and its primary continent **Myrdae**.

| Path                             | Purpose                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `wiki/world/Oberra.md`           | Planet-level overview                                                         |
| `wiki/world/Myrdae.md`           | Continent overview; five major regions                                        |
| `wiki/world/locations/<Name>.md` | Canonical geography (what a place *is*)                                       |
| `wiki/world/artifacts/<Name>.md` | Campaign-agnostic artifacts, relics, and mythic objects                       |
| `wiki/world/gods/<Name>.md`      | Individual deity pages; master table in `wiki/concepts/Pantheon of Myrdae.md` |

### World Ingest

When a DM world-building document is added to `raw/`:

1. Read the source.
2. Create or update the matching `wiki/world/` page (location, god, or other world entity).
3. Link from `wiki/world/Myrdae.md` (or `Oberra.md`) if the page is a new entry.
4. Add cross-references: campaign location pages that describe party experience at this world location should link to the world page.
5. Do **not** record campaign-specific events on world pages. World pages describe what exists; campaign pages describe what happened.
6. Update `index.md` (World section) and append to `log.md`.

### World vs Campaign Scope Rule

- `wiki/world/locations/Adsuren.md` — canonical city: geography, districts, factions, history.
- `wiki/locations/SoD/` — what the SoD party experienced in Adsuren.

If a location from a campaign page lacks a world entry, create the world stub and note that it needs population.

## Special Files

- `index.md` is content-oriented. It catalogs wiki pages with one-line summaries.
- `log.md` is chronological operational history. It records ingests, lint passes, workflow changes, and major wiki changes, but must stay out of answer retrieval and player-facing source browsing.
