import fs from "fs";
import path from "path";
import type { NextRequest } from "next/server";

// Session audio lives OUTSIDE public/ (in apps/web/media/session-audio), so it
// is never served as a Next.js static asset. Static public files are
// snapshotted when the server boots, so anything synced after start-up would
// 404 until the next restart. This route handler is the sole server for these
// files: it reads from disk on every request, so newly synced recordings are
// available immediately — the same "dynamic" behavior as DB content — and every
// response gets uniform, per-status cache headers (see below).
//
// The public URL is unchanged (/media/session-audio/...); only the on-disk
// location moved. The sync script (scripts/sync-session-audio.mjs) writes here.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIO_ROOT = path.join(process.cwd(), "media", "session-audio");

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};

// Recordings are immutable once synced (the Drive file id is baked into the
// filename), so a found file is safe to cache. A missing file, by contrast, is
// almost always transient — it simply hasn't been synced from Drive yet — so
// its 404 must never be cached, or a stale "not found" would outlive the sync
// (exactly the bug this route was added to prevent). These headers are set here
// rather than in next.config so they can differ by status; a blanket
// next.config rule would force the cacheable directive onto 404s too.
const SUCCESS_CACHE_CONTROL = "public, max-age=3600, must-revalidate";

// A missing recording is almost always transient — the file simply hasn't been
// synced from Drive yet. Never let a CDN cache the 404, or a stale "not found"
// would outlive the sync (exactly the bug this route was added to prevent).
function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store, must-revalidate" },
  });
}

function resolveWithinRoot(segments: string[]): string | null {
  const relPath = segments.map((segment) => decodeURIComponent(segment)).join("/");
  const normalized = path.normalize(path.join(AUDIO_ROOT, relPath));
  // Confine to AUDIO_ROOT — reject any path-traversal attempt.
  if (normalized !== AUDIO_ROOT && !normalized.startsWith(AUDIO_ROOT + path.sep)) {
    return null;
  }
  return normalized;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  const { segments } = await params;
  const filePath = resolveWithinRoot(segments);
  if (!filePath) {
    return notFound();
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    return notFound();
  }
  if (!stats.isFile()) {
    return notFound();
  }

  const contentType =
    CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const total = stats.size;
  const rangeHeader = request.headers.get("range");

  // Honor Range requests so <audio> seeking works like it does for static files.
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      let start = match[1] ? Number.parseInt(match[1], 10) : 0;
      let end = match[2] ? Number.parseInt(match[2], 10) : total - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= total) end = total - 1;
      if (start > end || start >= total) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      const chunk = fs.readFileSync(filePath).subarray(start, end + 1);
      return new Response(chunk, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": SUCCESS_CACHE_CONTROL,
        },
      });
    }
  }

  return new Response(fs.readFileSync(filePath), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": SUCCESS_CACHE_CONTROL,
    },
  });
}
