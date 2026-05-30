import { NextRequest, NextResponse } from "next/server";
import { getPageLayout, getPageGrid, getPageCanvas } from "@/lib/pageLayouts";

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("page") ?? "/";
  const items  = getPageLayout(pageId);
  const grid   = getPageGrid(pageId);
  const canvas = getPageCanvas(pageId);
  return NextResponse.json({ items, grid: grid ?? null, canvas: canvas ?? null });
}
