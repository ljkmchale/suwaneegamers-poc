import { NextRequest, NextResponse } from "next/server";
import { getPageLayout, getPageGrid } from "@/lib/pageLayouts";

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("page") ?? "/";
  const items = getPageLayout(pageId);
  const grid = getPageGrid(pageId);
  return NextResponse.json({ items, grid: grid ?? null });
}
