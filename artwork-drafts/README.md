# Suwanee Gamers PhotoCraft workspace

Codex and Claude Code on Larry's Windows machine have a local stdio MCP server
named `suwaneegamers-photocraft`, using the installed PhotoCraft CLI.
Start a new agent session after configuration to load its tools.

PhotoCraft may read files beneath this repository and write drafts beneath this
directory. Use separate filenames for parallel agent work; MCP sessions have
independent documents. Generated drafts are ignored by Git.

Example request: "Use PhotoCraft to open the approved campaign artwork, create
a layered title-card draft, and save the project plus a PNG in artwork-drafts."

Read the full campaign source and relevant Chronicle scene skill before selecting
characters or depicting events. Preserve approved character references. Use
PhotoCraft's command discovery rather than guessing command IDs or parameters.
The MCP server is headless; edits do not appear in an already-open desktop window.
Open the saved PSD or .pcraft project in PhotoCraft to review it.

PhotoCraft edits and composes images. AI generation requires a separate image
generator; video generation and assembly require a separate video tool. PhotoCraft
can prepare title cards, backgrounds, overlays, and individual frames for videos.

To publish a reviewed image, copy it to apps/web/media/images, use its
/media/images/ URL, update the relevant session mapping, rebuild the Chronicle,
and sync generated content to SQLite following docs/AI_ARCHITECTURE.md. Production
activation is a separate build and deployment step.
