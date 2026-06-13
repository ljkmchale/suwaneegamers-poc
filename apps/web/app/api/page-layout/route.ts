import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { getPageLayout, getPageGrid, getPageCanvas } = await import("@/lib/pageLayoutRead");
  const pageId = req.nextUrl.searchParams.get("page") ?? "/";
  const items  = getPageLayout(pageId);
  const grid   = getPageGrid(pageId);
  const canvas = getPageCanvas(pageId);
  return NextResponse.json({ items, grid: grid ?? null, canvas: canvas ?? null });
}
