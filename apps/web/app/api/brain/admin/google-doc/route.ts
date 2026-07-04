import { NextRequest, NextResponse } from "next/server";
import { pullGoogleDocToRaw } from "@/lib/brain/google-docs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const url = String(body.url ?? "").trim();
    const title = String(body.title ?? "").trim();
    const filename = String(body.filename ?? "").trim();
    const overwrite = Boolean(body.overwrite);

    if (!url) return NextResponse.json({ error: "URL is required." }, { status: 400 });

    const result = await pullGoogleDocToRaw({ url, title, filename, overwrite });
    return NextResponse.json({ ok: true, path: result.relativePath, characterCount: result.characterCount });
  } catch (error) {
    console.error("[Brain Admin Google Doc]", error);
    const e = error as Error & { statusCode?: number };
    return NextResponse.json({ error: e.message }, { status: e.statusCode ?? 500 });
  }
}
