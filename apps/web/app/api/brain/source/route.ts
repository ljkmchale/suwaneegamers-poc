import { NextRequest, NextResponse } from "next/server";
import { hasIndex, loadIndex } from "@/lib/brain/vector-store";
import { brainConfig } from "@/lib/brain/config";
import path from "node:path";
import fs from "node:fs/promises";

export const dynamic = "force-dynamic";

function isInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function GET(request: NextRequest) {
  try {
    const sourcePath = request.nextUrl.searchParams.get("path") ?? "";
    if (!sourcePath) return NextResponse.json({ error: "Missing path query parameter." }, { status: 400 });
    if (!(await hasIndex())) return NextResponse.json({ error: "Index not found. Run npm run index first." }, { status: 409 });

    const visibility = request.nextUrl.searchParams.get("visibility") ?? "players";
    const index = await loadIndex();
    const page = index.pages?.[sourcePath];
    if (!page) return NextResponse.json({ error: "Source is not in the current index." }, { status: 404 });
    if (visibility !== "dm" && page.visibility === "dm") {
      return NextResponse.json({ error: "This source is DM-only." }, { status: 403 });
    }

    const absolutePath = path.resolve(brainConfig.vaultRoot, sourcePath);
    if (!isInside(brainConfig.vaultRoot, absolutePath)) {
      return NextResponse.json({ error: "Invalid source path." }, { status: 400 });
    }

    const markdown = await fs.readFile(absolutePath, "utf8");
    return NextResponse.json({
      title: page.title,
      path: page.path,
      campaign: page.campaign,
      visibility: page.visibility,
      links: page.links ?? [],
      backlinks: page.backlinks ?? [],
      markdown,
    });
  } catch (error) {
    console.error("[Brain Source]", error);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
