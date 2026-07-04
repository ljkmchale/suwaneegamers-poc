import { type NextRequest } from "next/server";
import { search } from "@/lib/search";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = search(q);
  return Response.json(results, {
    // Search is deterministic for a given query; a short private cache absorbs
    // typo-correction and back-and-forth keystrokes without hiding new content
    // for long. Not shared-cacheable since results may include admin-only pages.
    headers: { "Cache-Control": "private, max-age=10" },
  });
}
