import { NextRequest, NextResponse } from "next/server";
import { getPageLayout } from "@/lib/pageLayouts";

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("page") ?? "/";
  const items = getPageLayout(pageId);
  return NextResponse.json({ items });
}
