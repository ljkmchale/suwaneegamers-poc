import fs from "fs";
import path from "path";

// Site images live OUTSIDE public/ (in apps/web/media/images), so they are
// never served as Next.js static assets. Static public files are snapshotted
// when the server boots, so anything synced after start-up would 404 until the
// next restart — and because that 404 was served with a cacheable response,
// Cloudflare pinned it and the image stayed broken even after a redeploy.
//
// This route handler is the sole server for these files: it reads from disk on
// every request, so newly synced artwork is available immediately — the same
// "dynamic" behavior as DB content — and every response gets uniform,
// per-status cache headers (see below). Mirrors app/media/session-audio.
//
// The Drive sync scripts and scripts/optimize-images.mjs write here.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_ROOT = path.join(process.cwd(), "media", "images");

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
};

// Artwork is replaced in place by the sync scripts rather than versioned in the
// filename, so it can't be immutable — an hour matches the TTL the old
// next.config `/images/:path*` rule used. A missing file, by contrast, is
// almost always transient (it simply hasn't been synced from Drive yet), so its
// 404 must never be cached, or a stale "not found" would outlive the sync.
// That is exactly the bug this route was added to prevent, and it cannot be
// expressed in next.config: a blanket rule there forces one directive onto
// every status, including 404s.
const SUCCESS_CACHE_CONTROL = "public, max-age=3600, must-revalidate";

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store, must-revalidate" },
  });
}

function resolveWithinRoot(segments: string[]): string | null {
  const decoded = segments.map((segment) => decodeURIComponent(segment));
  // Never serve dotfiles. The image directories hold `.drive-cache.json` sync
  // manifests (upstream Drive ids and sizes) that were publicly readable while
  // these files lived under public/; they are bookkeeping, not site content.
  if (decoded.some((segment) => segment.startsWith("."))) {
    return null;
  }
  const normalized = path.normalize(path.join(IMAGE_ROOT, decoded.join("/")));
  // Confine to IMAGE_ROOT — reject any path-traversal attempt.
  if (normalized !== IMAGE_ROOT && !normalized.startsWith(IMAGE_ROOT + path.sep)) {
    return null;
  }
  return normalized;
}

export async function GET(
  _request: Request,
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

  return new Response(fs.readFileSync(filePath), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stats.size),
      "Cache-Control": SUCCESS_CACHE_CONTROL,
    },
  });
}
