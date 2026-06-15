import { type NextRequest } from "next/server";
import { search } from "@/lib/search";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = search(q);
  return Response.json(results);
}
