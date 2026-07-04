import { NextRequest, NextResponse } from "next/server";
import { hasIndex, loadIndex } from "@/lib/brain/vector-store";
import type { BrainIndex, PageEntry } from "@/lib/brain/vector-store";
import path from "node:path";

export const dynamic = "force-dynamic";

function normalizePageKey(value: string): string {
  return String(value).toLowerCase().replaceAll(path.sep, "/").replace(/\.md$/i, "").trim();
}

function resolvePage(index: BrainIndex, target: string, visibility: string): PageEntry | null {
  const normalizedTarget = normalizePageKey(target.split("#")[0]);
  const pages = Object.values(index.pages ?? {}).filter((page) => visibility === "dm" || page.visibility !== "dm");

  return (
    pages.find((page) => normalizePageKey(page.path) === normalizedTarget) ??
    pages.find((page) => normalizePageKey(page.path.replace(/^wiki\//, "").replace(/\.md$/i, "")) === normalizedTarget) ??
    pages.find((page) => normalizePageKey(page.title) === normalizedTarget) ??
    pages.find((page) => normalizePageKey(path.basename(page.path, ".md")) === normalizedTarget) ??
    null
  );
}

export async function GET(request: NextRequest) {
  try {
    const target = request.nextUrl.searchParams.get("target") ?? "";
    if (!target) return NextResponse.json({ error: "Missing target query parameter." }, { status: 400 });
    if (!(await hasIndex())) return NextResponse.json({ error: "Index not found. Run npm run index first." }, { status: 409 });

    const visibility = request.nextUrl.searchParams.get("visibility") ?? "players";
    const index = await loadIndex();
    const page = resolvePage(index, target, visibility);
    if (!page) return NextResponse.json({ error: `Could not resolve [[${target}]].` }, { status: 404 });

    return NextResponse.json({ title: page.title, path: page.path, campaign: page.campaign, visibility: page.visibility });
  } catch (error) {
    console.error("[Brain Resolve Source]", error);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
