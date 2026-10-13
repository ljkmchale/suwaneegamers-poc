# Myra's knowledge layers

What Myra knows comes from several stores. This is the map: who writes each one,
who reads it, and where it enters a conversation. Audited 2026-10-13. Keep it
current when a layer is added or moves.

The rule that keeps these from drifting into each other: **one fact has one
home.** Everything else should be generated from it or fetched from it, never
copied by hand.

| Layer | Home | Written by | Reaches Myra how |
|---|---|---|---|
| Campaign/DM/link facts | `content/assistant-brain.md` (hand prose + `AUTO` block) | `scripts/build-assistant-brain.mjs` (daily `assistant-brain` job) from `campaigns.json`, `dungeon-masters.json`, `portal-links.json`; hand edits outside the markers | In the prompt every turn (`knowledge`, ~8.7K chars) |
| Lore, sessions, characters | `apps/web/brain-vault/` and `brain-data/brain-index.json` | `chronicles-sources` job, curation job, indexer | On demand: `search_knowledge_base` → `/api/brain/ask` |
| Session recaps | session summaries in SQLite | DMs (Session Summaries doc) via the notes sync | Dispatch metadata (`recaps`), used by the deterministic recap path |
| Schedule | live calendar | Google Calendar | Dispatch metadata (`events`), deterministic answers |
| What's new | `content/assistant-updates.json` | Hand-curated changelog | **On demand**: `get_assistant_info("whats_new")` |
| Website roadmap | `content/site-roadmap.json` | Google Doc sync | **On demand**: `get_assistant_info("roadmap")` |
| How Myra works | `content/assistant-self-knowledge.md` | Hand-curated (admin detail marked) | **On demand**: `get_assistant_info("how_i_work")` |
| Learned answers | `content/assistant-learned.json` | `scripts/learn-assistant.ts` from grounded RAG answers | Dispatch metadata (`faq`), served verbatim |
| Speech repair | `assistant-pronunciations.json`, `assistant-mishearings.json` | Hand + tooling | Dispatch metadata, transcript repair |
| Personas, tuning, routing | `assistant-personas.json`, `assistant-tuning.json`, `assistant-routing-overrides.json` | Admin UI, autotuner, self-heal | Dispatch metadata |
| Self-heal history | `assistant-remediation.json`, `assistant-heal-log.json` | Self-heal jobs | Admin reports only |

All JSON is DB-first (`content_documents`), so a file edit needs
`pnpm content:sync-documents` (or `writeContent`) to take effect.

## Findings from the audit

1. **The changelog had gone stale.** `assistant-updates.json` had nothing newer
   than 2026-09-04, so "what's new?" would have been five weeks behind.
   *Fixed:* entries added for the spoken-delivery changes. **Process:** when a
   change members would notice ships, add an entry the same day.
2. **Auto-learning stored context-dependent fragments and non-answers.** Five of
   eleven learned FAQ entries were bad: replies that only make sense mid
   conversation ("No, I want the bad gods"), transcription stumbles ("Hey, um
   Collective of Myrdae"), and "the excerpts do not contain…" answers that would
   have been served verbatim to anyone asking the same words. *Fixed:*
   `isLearnableQuestion` rejects follow-up openers and disfluencies,
   `isRefusalAnswer` recognises "does not contain / not yet name / no information"
   style non-answers, and `getLearnedFaqForAgent` re-checks stored entries at read
   time so older entries stop being served. The five bad entries were removed.
3. **Three real-world compartments rode in every prompt.** Roadmap, changelog and
   self-model (~6–9K characters) were present on every turn although they are
   only needed when someone asks. *Fixed:* moved behind `get_assistant_info`, so
   each turn's prefix is smaller (less latency, and less plan quota on the
   subscription).
4. **Overlap to watch:** the `AUTO` block in `assistant-brain.md`, the recaps and
   the vault can all describe a campaign. The brain's `AUTO` block is generated
   from the same site data, so drift is low, but the hand-written prose above the
   marker must never restate facts that exist below it or in the vault. Prefer
   "retrieve from Chronicles" over copying.
5. **Growth to confirm:** `assistant-remediation.json` is the largest assistant
   file (57 entries, ~54 KB). It is not sent to the agent, but its retention
   should be confirmed so it does not grow without bound.

## Not done on purpose

- **Stage directions driving the UI.** `<<...>>` directions are removed from
  speech by `spoken_text.spoken_cleanup`. Using them to drive the orb or other UI
  would change the orbs, which are deliberately unchanged.
