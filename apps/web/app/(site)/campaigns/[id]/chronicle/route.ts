import fs from "fs";
import path from "path";
import { contentDir } from "@/lib/contentFiles";
import { findCampaign } from "@/lib/campaigns";

// Serves a campaign's Living Chronicle: a self-contained, full-screen HTML page
// built from the campaign's session-notes Google Doc (see chronicle-poc/ and
// scripts/sync-chronicle.mjs). We return the raw HTML from a Route Handler so
// the immersive layout renders without the site's Navbar/Footer chrome, while
// still sitting behind the members-only proxy gate like every other route.
//
// The file lives under content/chronicles/<id>.html — read at request time, so
// the daily sync is reflected without a rebuild (unlike public/, which is
// snapshotted at boot).

export const revalidate = 300;

function chroniclePath(id: string) {
  return path.join(contentDir(), "chronicles", `${id}.html`);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // id must be a real campaign slug (guards path traversal + stray routes)
  if (!/^[a-z0-9-]+$/.test(id) || !findCampaign(id)) {
    return new Response("Not found", { status: 404 });
  }

  const file = chroniclePath(id);
  if (!fs.existsSync(file)) {
    return new Response("No chronicle has been published for this campaign yet.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const html = fs.readFileSync(file, "utf-8");
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, max-age=300",
    },
  });
}
