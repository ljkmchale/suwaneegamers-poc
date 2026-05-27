import { NextRequest, NextResponse } from "next/server";
import { getPageLayout } from "@/lib/pageLayouts";

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("page") ?? "/";
  const order = getPageLayout(pageId);
  return NextResponse.json({ order });
}
