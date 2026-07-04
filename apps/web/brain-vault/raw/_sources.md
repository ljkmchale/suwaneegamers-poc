# Sources

This file documents the external source documents that should be placed in `raw/` as immutable source files.

Per the `AGENTS.md` schema, `raw/` is the immutable layer. The LLM reads from it but does not modify it. Place downloaded or exported copies of the source documents here.

## Known Sources

| Source                                              | Type       | External Link                                                                                                           | Local File         |
| --------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------ |
| The Silent Vanguard - Player's Reference & Tracking | Google Doc | https://docs.google.com/document/d/141DTlKtOn2AgpWzEpUsey6YlLSfK1hRU36Rk5_cSuJY                                         | Not yet downloaded |
| SoD - Campaign Player Notes | Google Doc | https://docs.google.com/document/d/1pKpiVcOl-mjtJMUD4tuTS6A4UZP3w6ISnehpX8LORH8/edit | raw/sod-campaign-player-notes.md |
| HoE - Campaign Player Notes | Google Doc | https://docs.google.com/document/d/1ENCKlQLCpkjefs8AgZYXn0_89OgUmJx5ssIFMuOKut4/edit | raw/hoe-campaign-player-notes.md |
| Dungeons III - Campaign Player Notes | Google Doc | https://docs.google.com/document/d/1115KjT1J7g-jy4kQXBXzp4vHhoOhPyqrNxcTZkEEAHY/edit | raw/dungeons-iii-campaign-player-notes.md |
| Adsuren Gazetteer (v.26.02.16)                      | PDF        | https://docs.google.com/document/d/13vD63-iUc9eMgQz0Ycoi-n7LMDfw_I6NWImY6N_fqNA/edit?tab=t.0                          | `Adsuren - Gazetteer (v.26.02.16).pdf` |

## Instructions

To add a source manually:
1. Export or copy the document content into a file in this directory.
2. Name the file descriptively (e.g., `hoe-campaign-player-notes.md`).
3. Do not edit it once placed here.
4. Follow the Ingest workflow in `AGENTS.md` to extract from the file into `wiki/`.

To pull a Google Doc:
1. Start the query app and use the DM-only Pull Google Doc form, or run `npm run pull-doc -- --url "<Google Doc URL>" --title "<Source Title>" --filename "<file-name>.md"` from `brain-query/`.
2. Make sure the Google Doc is shared so anyone with the link can view it. The importer reads the plain-text export and does not use Google OAuth.
3. The importer writes the exported text into `raw/` and updates this source registry.
4. Follow the Ingest workflow in `AGENTS.md` to extract durable wiki pages, then run `npm run index`.

The query app also checks tracked docs in `brain-query/google-doc-sources.json` automatically while the server is running. By default it checks once per day and rewrites a raw export only when the Google Doc text hash changes.

Before a raw export is overwritten, the app backs up the previous file under `raw/.history/<source>/` and keeps recent history. The app refuses suspiciously small pulls so a bad Google export does not silently replace a good raw source.

After raw material has been extracted into `wiki/`, write a processed receipt from `brain-query/` with `npm run mark-processed -- --filename "<raw-file.md>"`. Use `npm run processed-status` to see whether any raw source is unprocessed or stale.

## Known Sources

| Source | Type | External Link | Local File |
|---|---|---|---|
| Bloody Endeavor - Campaign Player Notes | Google Doc | https://docs.google.com/document/d/1p35JgGjlsAk6Ul8Y3cJC5P6Jdedr3pHSQQ29Y0ljBuc/edit | raw/bloody-endeavor-campaign-player-notes.md |
| Myrdae World Guide | Google Doc | https://docs.google.com/document/d/1PGWzoocfjPNQ69Q-JsVmNXCFo76a3Z_IkcBuBeDj4yQ/edit | raw/myrdae-world-guide.md |
| Myrdae Stories and Tales | Google Doc | https://docs.google.com/document/d/1cB30vxRCQXjrUt-JV4z8alDVZWvHtqFkYIwhoGlXYJ0/edit | raw/myrdae-stories-and-tales.md |
| Abbey of Light | Google Doc | https://docs.google.com/document/d/14hX4cryRE61O6wLcZ26qFtsAXACJzqU60rwIgFkQYjQ/edit | raw/abbey-of-light.md |
| Emberstran Gazetteer | Google Doc | https://docs.google.com/document/d/1oECFiNos1Qqa1CfGo-2DJWbyet9SOF_gMKd3ZR2kY6c/edit | raw/emberstran-gazetteer.md |
| Scarwatch Hold Gazetteer | Google Doc | https://docs.google.com/document/d/1U1YgTimFZtG1VsC4fjWoh1wVCxGGdokU4peu8hh6jx8/edit | raw/scarwatch-hold-gazetteer.md |
| Nunglthil Gazetteer | Google Doc | https://docs.google.com/document/d/1Uow9Y0-_llBAp4meZsA-QEFTmMslbMV_IlgYV3UjNxg/edit | raw/nunglthil-gazetteer.md |
| O'naren Gazetteer | Google Doc | https://docs.google.com/document/d/1ot7DXOzqFjYKucVqVu-tqmTRflrfBKSAwRZjNZtGLXU/edit | raw/onaren-gazetteer.md |
| Ahndashere Gazetteer | Google Doc | https://docs.google.com/document/d/1tfgzGJK9ZZcaoiva1lfVAgR0xmbe_2Mn0uFoVj9bFLQ/edit | raw/ahndashere-gazetteer.md |
| Basctdelm Gazetteer | Google Doc | https://docs.google.com/document/d/1kaDz6BPYRFUbRPyZefm41tVdlCHEUBqiZkgKtnDw1qk/edit | raw/basctdelm-gazetteer.md |
| Climbor Gazetteer | Google Doc | https://docs.google.com/document/d/1BE2wwvBrfkFCBD60EWwL-freUByHv7EgwW3djne7DS4/edit?tab=t.0 | raw/climbor-gazetteer.md |
| Dhá Chaomhnóir Gazetteer | Google Doc | https://docs.google.com/document/d/1I1bIs4KJFUtpgOciBY24xrDtWG-U-HF-Zi1fkewx7tY/edit?tab=t.0 | raw/dha-chaomhnoir-gazetteer.md |
| Everlight Gazetteer | Google Doc | https://docs.google.com/document/d/1h-nnyV84AUZnSn1DgnK2msedBhNuf7rPuvPNDb9Xo1M/edit?tab=t.0 | raw/everlight-gazetteer.md |
| Gevakaln Gazetteer | Google Doc | https://docs.google.com/document/d/1PZceMNA0XQoT_dOqVyN-f82iLiibxulwijxuxq_j0cs/edit?tab=t.0 | raw/gevakaln-gazetteer.md |
| Gibuldon Gazetteer | Google Doc | https://docs.google.com/document/d/1KNei0mo4Zq-_AsEOWJo9N7Zb6AKMS-bfZORK-UxixZ4/edit?tab=t.0 | raw/gibuldon-gazetteer.md |
| The Crystal Bottle - Campaign Player Notes | Google Doc | https://docs.google.com/document/d/1beYmLQBe8qQCM1_DzLCMo1H-6vFN1FeQ5fU6Y5lc43o/edit | raw/the-crystal-bottle-campaign-player-notes.md |
| Myrdae Reference for DMs | Google Doc | https://docs.google.com/document/d/1BGx_-fz7LsgElP6Lk2RFbh2-RRFTnOhx7RJ15ymoShs/edit | (ingested directly; no raw file) |
| The Silent Vanguard - Player's Reference & Tracking | Google Doc | https://docs.google.com/document/d/141DTlKtOn2AgpWzEpUsey6YlLSfK1hRU36Rk5_cSuJY/edit | raw/the-silent-vanguard-player-reference.md |
- `worldofmyrdae-map-database.md` - structured map editor export from WorldofMyrdae with locations, coordinates, types, regions, and routes.
