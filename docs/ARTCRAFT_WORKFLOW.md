# ArtCraft generation for Codex and Claude Code

ArtCraft Studio 0.41.0 is installed on Larry's Windows machine. Both agents are
configured with `suwaneegamers-artcraft`, a local stdio adapter in
`scripts/artcraft-mcp.mjs`. Start a new session to discover its tools.

The adapter uses the official key-authenticated Omni API, independently of the
desktop application. Signing into the desktop app does not authenticate the API.
Official specification:
https://github.com/storytold/artcraft/blob/main/_docs/artcraft_omni_api.md

## Account setup

ArtCraft staff must enable API access for the account. In
https://app.getartcraft.com/ select Account -> Settings -> API Keys. If the section
is absent, request enablement from ArtCraft support. Save the key privately in
`C:\Users\Larry McHale\.artcraft\api-key.txt` or set `ARTCRAFT_API_KEY` in the
agent's environment. Do not paste secrets into chats or commit them. The adapter
reads the key file on each call, so adding it does not require server restart.

## Tools and workflow

- `artcraft_setup_status`: reports credential presence, without validating it.
- `artcraft_generate_video`: submits one job and returns its token. Generation
  spends credits; use for an explicitly requested clip. Choose a model currently
  available to the account. Supply prompt, duration, aspect ratio and optionally
  start/end frames or reference images.
- `artcraft_video_job_status`: queries a job. On success the result URL is
  `state.maybe_result.media_links.cdn_url`.

Read canonical campaign notes and the applicable Chronicle scene skill first.
Prepare or edit approved reference images in PhotoCraft. URL references must be
reachable by ArtCraft's server; localhost and local disk paths cannot work. Existing
site images use `https://suwaneegamers.net/media/images/...`; check the exact URL
returns image bytes before submission. New private drafts need a separately
authorized upload before URL-based generation. This adapter does not upload files.

Record the returned job token and submission idempotency token. Do not blindly
retry a timed-out or failed submission: it may already have created a paid job.
Poll status in separate calls until complete; failed/cancelled terminal states
require inspection. Preview the resulting clip before choosing site placement.

## Architecture boundaries

This is an agent-side workflow, with no website route or Myra tool changes.
It reads credentials outside the repository, submits to api.storyteller.ai,
and returns remote result links. No scheduler rewrites its state or files.
PhotoCraft drafts remain in artwork-drafts. Site image publishing continues
through apps/web/media/images, campaign mappings, generators, and DB sync.
Video hosting and publishing are separate work; no video route was added.
No production build or activation is needed for the local MCP setup.

Credential-free checks cover MCP initialization/discovery, setup status and
invalid local reference rejection. A paid generation and finished result remain
unverified until account access and a key are available.
