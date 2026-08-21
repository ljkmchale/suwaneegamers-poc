# Souls of Destiny Chronicle

A self-contained living chronicle built from the player-authored Souls of Destiny campaign notes.

## Sources and outputs

| File | Purpose |
| --- | --- |
| `sod-chronicle.md` | Source copy of the linked SoD player-notes document. Preserve its wording. |
| `session-images.json` | Persistent chapter-to-image assignments. |
| `chronicle.css` | Chronicle presentation, inlined during the build. |
| `build-chronicle.mjs` | Parser and self-contained HTML generator. |
| `souls-of-destiny-chronicle.html` | Local generated output. |
| `content/chronicles/souls-of-destiny.html` | Runtime copy served at `/campaigns/souls-of-destiny/chronicle`. |

## Rebuild

```powershell
node sod-chronicle-poc/build-chronicle.mjs
Copy-Item -LiteralPath sod-chronicle-poc/souls-of-destiny-chronicle.html -Destination content/chronicles/souls-of-destiny.html
```

The authoritative upstream source is the Google Doc referenced by the campaign configuration. The existing `SuwaneeGamers Chronicle Sync` scheduled task runs `scripts/sync-chronicle.mjs`, which refreshes both HOE and SoD, preserves each `session-images.json`, rebuilds the HTML, and copies it to the runtime path. The SoD safety guard refuses an export with fewer than ten parsed sessions.
