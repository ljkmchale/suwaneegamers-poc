import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    // Keep optimized images for 1 hour instead of the default 1 year, so
    // sync-script image updates are visible in production within an hour
    // without needing a rebuild.
    minimumCacheTTL: 3600,
  },
  async headers() {
    // Deliberately empty. Both media trees — images and session audio — now
    // live outside public/ and are served by route handlers
    // (app/media/images/[...segments] and app/media/session-audio/[...segments])
    // that set Cache-Control per status: success responses are cacheable, but
    // 404s send no-store so a CDN can never pin a stale "not found".
    //
    // Do not add a blanket `source: "/media/..."` rule here. It would apply to
    // those route handlers' responses too and force the cacheable directive
    // onto 404s — which is exactly how a missing image stayed broken behind
    // Cloudflare even after a redeploy.
    return [];
  },
};

export default nextConfig;
