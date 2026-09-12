import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { getLiveAnalytics } from "@/lib/liveAnalytics";
import { analyticsAudience } from "@/lib/analyticsFilters";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if ((await getAdminSession()).isAdmin !== true) return NextResponse.json({ error: "Admin sign-in required" }, { status: 401 });
  return NextResponse.json(getLiveAnalytics(analyticsAudience(request.nextUrl.searchParams.get("audience") ?? undefined)), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
