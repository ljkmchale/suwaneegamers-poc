# Myra planning experiment

The Python planner is connected to the live worker's recap turn handler.
Activate worker-only changes with `scripts/restart-voice-agent.ps1` from the
repository root. No website build, content sync, or scheduler change is required.

`src/schedule_agent/planning.py` represents at most three allowlisted read
operations with an explicit campaign and a decision trace. It preserves recap,
participant research, and schedule requests in compound questions. Ambiguous
recaps ask for clarification. Explicit campaign selection wins over membership;
membership does not grant access. Model routing overrides bypass planning.

The worker resolves real catalog/dispatch aliases, reads dispatched recaps and
calendar events, and calls the existing authenticated Chronicles API for session
participants. It uses the current recap's exact session title and rejects sources
that do not match it. Missing/unavailable evidence produces an explicit inability
to verify participants while preserving the recap and schedule answer. Existing
search behavior, including unsourced clarification responses, stays intact.

The plan never evaluates code or accepts permission claims. Worker reads run off
the event loop with a 28-second outer timeout; stale results are discarded before
speaking. Routing overrides bypass planning. `planning_readers.py` remains an
offline helper adapter; the live adapters live beside Myra's authenticated state
in `agent.py`. Snapshot source labels identify provenance, not freshness or truth.

From this service directory:

```powershell
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe tests/eval_planning.py
```

Initial result: 8/8 curated routing cases versus 5/8 for the modeled current
recap-before-schedule branch. Existing worker intent predicates are used, but
campaign resolution inputs are supplied by fixtures. This is a narrow comparison,
not a replay of the complete voice worker. The live integration suite tests the
actual conversation hook, aliases, profile defaults, authenticated transport,
missing sources, stale turns, speech formatting, and rejection of older sessions.
Planning took under 1 ms per case in the initial run; no model calls or paid API
requests were made. This measures planning overhead only. It does not measure
answer correctness, retrieval quality, end-to-end latency, or production costs.

Production smoke testing uses `tests/smoke_planning.py` with credentials from the
existing authenticated production token smoke helper. It publishes locally
synthesized speech into LiveKit and requires actual STT, agent transcription,
non-silent output audio, and matching analytics. Run only with authorization to
test production; the configured voice/model providers may charge normal usage.

Live testing exposed an existing vault lag: the Souls of Destiny dispatch recap
was Session 14, but a generic latest-session lookup returned Session 08. The
planner now refuses to use that older material to substantiate current-session
participants. The follow-up repaired publication: scheduled refresh publishes
missing dated session bodies verbatim and uses approved summaries as fallback,
preserving curated pages. The indexer verifies hash and player visibility before
stamping the freshness manifest. The worker consults it for newer sessions and
retrieves through the existing authenticated API. The bounded keyword rules are
not a general natural-language planner.
Compound requests can increase retrieval/model costs.

The immediate finding supports retaining Python. Lisp would need to demonstrate
clearer rules or easier extension on the same evaluation before adding a runtime.

## Verification after live integration

- Python suite: 126 passed, 1 skipped (Parakeet server dependencies live in a
  separate environment; actual Parakeet STT was exercised by the room smoke test).
- Existing website DM-access and signed-capability suites: 8 passed.
- Ruff, Python compilation, and architecture preflight passed.
- Live speech cases passed for ambiguous campaign clarification, Mad Mage recap
  plus absent-calendar response, and recap plus unavailable-participant lookup
  plus absent-calendar response. Each checked actual recognition, non-silent
  spoken output, and recorded analytics through the production dispatch path.
- The scheduled-event speech case also passed: Heroes of Emberstran's recap was
  followed by Wednesday, October 14 at 6:30 PM, matching the dispatched calendar.
  The full spoken response completed in about 55 seconds (including the complete
  recap); 5,485 non-silent received audio frames were observed.

Use `tests/smoke_planning.py <credentials-path> --scheduled` for a compound
question against the shortest current recap that has an upcoming calendar event.

## Freshness and expanded routing follow-up

- Published 69 missing session pages; source refresh checked all nine documents
  with no errors. A repeated refresh wrote zero pages and skipped indexing.
- Latest indexed coverage: A New Adventure 34, Bloody Endeavor 43, Dungeons III
  17, Heroes of Emberstran 36, Souls of Destiny 15, Silent Vanguard 5.
- Follow-up adds A New Adventure to web/tools catalogs and worker aliases, and
  connects its real player-notes document to scheduled refresh. Its notes include
  session 35 while approved summaries stop at 34. Access scope remains unchanged.
- 32 expanded real-resolver fixtures cover ambiguous campaigns, aliases,
  participant-only requests, compound time questions, and deferral of specific
  historical/lore/action questions to the model. These are curated routing tests,
  not a general language benchmark.
- Full Python suite: 166 passed, one environment-specific skip. Session publisher
  tests: four passed. Use `--freshness` for the live Souls of Destiny session 15
  recap plus next-game speech check.
- Live updated worker: session 15 recap plus the Sunday, November 1, 4:00 PM
  calendar answer passed in 29.8 seconds with 2,981 non-silent audio frames.
  Participant-only speech returned Lila, Kenton, Therric, Escanor, Zephyra and
  Esylla in 15.4 seconds with 1,505 non-silent frames. Both matched actual STT
  and recorded analytics. The API ignored short-answer prompts and appended
  long narrative/biographies; worker now selects the opening answer, with
  regression tests. Eight website access tests and architecture preflight passed.

## Complete campaign retrieval follow-up

A New Adventure is now scoped in both query engines and the voice worker.
Its notes are included in scheduled ingest and the DB-backed source directory;
35 source-backed session pages replace summary fallbacks or fill missing sessions.
ANA aliases match whole words. The hardcoded Silent Vanguard name guard applies
only to TSV, preventing its roster from leaking into other campaign answers.
Query cache v6 retires answers generated under the old scope rules.

Verification before activation: 170 Python tests passed (one environment-specific
skip), 35 real-resolver routing cases passed, four publisher tests passed, and
website scope/access tests passed. `tests/smoke_planning.py --ana` verifies a live
session 35 recap, documented participants, and calendar response in one turn.

The ANA voice smoke exposed fuzzy entity correction rewriting the campaign to
"a new Adventures", then broad retrieval timing out on participant lookup.
Exact campaign spans are now protected during name repair. Planner requests use
the API's `sessionTitle` selector, which verifies campaign and visibility and
composes from only that session's indexed chunks. It skips embeddings, broad
retrieval, and generic cached answers. Twenty website scope/access tests include
selected-session provenance, hidden-session denial, and cross-campaign denial.

Final live validation passed: A New Adventure session 35 recap, Ridley/Fungus/
Kaizo/Cerul/Relys/Affy, and Thursday October 15 at 6:15 PM were spoken together
in 57.36 seconds, with 5,738 non-silent received frames and matching recognized
question/analytics. The source's latest unfinished session had included an old
Session Summary appendix; publication now stops before summary/goals appendices,
with a regression test (five publisher tests total). The repeated publication
and refresh are idempotent. All six active campaigns' latest-session endpoints
were verified, and local/public production identities matched with dirty:false.

## Adjacent conversation evaluation (2026-10-10 UTC)

Real conversation-hook tests now cover clarification replies, replacement of a
campaign after a correction, participant and calendar follow-ups, expiry on an
unrelated turn, routing overrides, longer compound requests, timeout reporting,
and a second conversation hook superseding a blocked lookup. The superseded
answer cannot speak, record an answer, or overwrite the new campaign context.
Context lasts only across adjacent recap exchanges and grants no permissions.

The production four-turn smoke (`--conversation`) speaks an ambiguous compound
request, answers the clarification with Souls of Destiny, asks who was involved,
then corrects the campaign to A New Adventure. Each turn requires actual STT,
the expected answer in received agent transcription, audible TTS, and matching
SQLite analytics. It also checks that clarification retains the calendar part,
the participant follow-up does not repeat the recap, and the correction excludes
the previous campaign's participants. The first run exposed the repeated recap;
the participant-only predicate now accepts an initial "And". Newer-session recap
prompts request at most 60 words; approved dispatch summaries remain intact.

The historical routing comparison remains 8/8 versus 5/8 for the modeled old
recap-first baseline; the expanded single-turn resolver remains 35/35. A local
sample measured median planning time 0.0134 ms, maximum 0.8691 ms across the eight
fixtures. This measures Python routing only, with a small curated sample. It
does not establish a live latency advantage over the previous worker or Lisp.

The smoke reports handler latency, time to audible response after input playout,
and full spoken completion time separately. Input includes two seconds of
endpointing silence; audible replies can already be starting by its end. The
initial non-silent counter accepted tiny sample noise and produced invalid
negative first-audio timings; subsequent runs require sample amplitude >300 and
start that timer after input playout. Do not use the earlier first-audio numbers.

Cost boundary: plan construction itself makes no API calls. A newer recap and
participant request can each make a selected-session knowledge call; the calendar
uses dispatch data. The brain chat adapter currently discards provider token
usage, so these reads cannot be assigned a measured dollar cost from voice
analytics. LiveKit preemptive generation also emitted Claude usage during the
deterministic exchanges. Consequently neither zero total inference cost nor
production cost savings is established. No pricing estimate is invented, and
the existing preemptive setting is retained pending a controlled model-turn
latency comparison. A Lisp runtime or broader planner scope is not justified by
these results.

Final four-turn production smoke passed after worker activation:

| Turn | Handler ms | Full completion seconds |
| --- | ---: | ---: |
| Ambiguous recap + calendar | 0 | 6.22 |
| Souls of Destiny clarification | 2637 | 49.27 |
| Participant follow-up only | 1054 | 12.77 |
| A New Adventure correction | 996 | 13.74 |

The correction returned Ridley, Fungus, Kaizo, Cerul, Relys, and Affy, with no
Souls of Destiny participants. The clarification spoke session 15 plus November
1 at 4:00 PM. The follow-up improved from 62.86 seconds in the first run to
12.77 seconds by removing the unwanted recap; these are single observations,
not a statistical latency benchmark. The 60-word recap instruction was not
strictly honored by the model, so it is a prompt preference rather than an
enforced length guarantee. No source summary was truncated to achieve it.

