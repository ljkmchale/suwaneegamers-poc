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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
    // Keep optimized images for 1 hour instead of the default 1 year, so
    // sync-script image updates are visible in production within an hour
    // without needing a rebuild.
    minimumCacheTTL: 3600,
  },
  async headers() {
    return [
      {
        // Override Next.js's default "immutable, max-age=31536000" for all
        // files under public/images/ so the optimization cache respects the
        // shorter TTL above and Cloudflare doesn't cache stale images forever.
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
