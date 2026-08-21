# The Emberstran Chronicle (POC)

A single, self-contained HTML page that turns HOE's Google-Doc session notes into a
living, hero-driven chronicle. **The player-facing wording is never changed** — the page
only re-styles the doc's own text.

## Files

| File | What it is |
|---|---|
| `emberstran-chronicle.html` | **The deliverable.** One self-contained file — inline CSS + JS, fonts from Google Fonts. Open it anywhere, host it anywhere, edit it in any editor. |
| `hoe-chronicle.md` | The source: a Markdown export of the HOE session-notes Google Doc. |
| `chronicle.css` | The design (inlined into the HTML at build time). |
| `session-images.json` | **Your image assignments** — chapter number → image URL. Survives every rebuild. |
| `build-chronicle.mjs` | The generator. Re-reads the doc + images and rebuilds the HTML. |

## Adding session images (what Codex fills in)

Two equivalent ways — pick whichever is handy:

1. **Edit the HTML directly.** Near the top of `emberstran-chronicle.html` there is a clearly
   marked `window.SESSION_ART = { ... }` block. Paste an image URL next to a chapter number:
   ```js
   "01": "https://your-host/dyed-cane.jpg",
   ```
   Save. Done. A chapter with `""` keeps its procedural themed backdrop.

2. **Edit `session-images.json`** the same way, then rebuild (below). Use this one if you want
   the assignment to persist through the next doc re-sync.

Images may be any URL the browser can reach (an Imgur/Drive/site URL) or a path like
`/media/images/chronicle/hoe-01.webp` if you host them on the site.

## When a new session is written (maintenance)

The Google Doc is the source of truth. To pull in new chapters:

1. **Update the source.** Re-export the HOE doc to Markdown and replace `hoe-chronicle.md`
   (File → Download → Markdown in Google Docs, or a sync script — see below).
2. **Rebuild:**
   ```bash
   node chronicle-poc/build-chronicle.mjs
   ```
   This re-parses the doc, adds the new chapter(s), and **re-injects every image from
   `session-images.json`** so nothing is lost. The DM appendix (Quests / Prep / Session 0)
   is skipped automatically.
3. **Publish** the updated `emberstran-chronicle.html` wherever it lives.

New chapters get an automatic mood-art backdrop (keyed to the title) until you assign an image.

## Automated doc pull (LIVE)

A scheduled task does steps 1–2 automatically every day, so you normally don't run anything:

- **Task:** `SuwaneeGamers Chronicle Sync` (Windows Task Scheduler), daily at **10:34 AM**
  (just after the 10:32 roster sync).
- **What it runs:** [`scripts/sync-chronicle.cmd`](../scripts/sync-chronicle.cmd) →
  [`scripts/sync-chronicle.mjs`](../scripts/sync-chronicle.mjs).
- **What it does:** fetches the HOE doc's Markdown export, refreshes `hoe-chronicle.md`,
  and rebuilds `emberstran-chronicle.html` — re-injecting every image from
  `session-images.json`.
- **Safety guard:** if the export parses to fewer than 20 chapters (bad fetch, login
  redirect, or a format change), it **refuses to overwrite** the local copy and logs an error,
  so the page can never be blanked by a bad pull.
- **Log:** `logs/sync-chronicle.log` at the repo root.

Run it on demand any time with:

```bash
node scripts/sync-chronicle.mjs
```

**Requirements / caveats:**
- The HOE doc must stay **link-viewable** so the headless `…/export?format=md` fetch works
  without auth. (Confirmed working today.)
- The task keeps the **local** `emberstran-chronicle.html` fresh. If you're serving it from a
  Claude Artifact, that still needs a manual re-publish — or wire the built file into the site
  (below) so the sync updates what visitors see.

## Wiring into the site (optional, later)

Drop the built HTML at a route (e.g. `/campaigns/heroes-of-emberstran/chronicle`), or port the
generator into a Next page that reads `hoe-chronicle.md` + `session-images.json` at build time.
