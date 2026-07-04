import { NextRequest, NextResponse } from "next/server";
import { retrieve } from "@/lib/brain/query";
import { hasIndex } from "@/lib/brain/vector-store";
import { brainConfig } from "@/lib/brain/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") ?? "";
    if (!q.trim()) return NextResponse.json({ error: "Missing q query parameter." }, { status: 400 });
    if (!(await hasIndex())) return NextResponse.json({ error: "Index not found. Run npm run index first." }, { status: 409 });

    const topK = Math.max(3, Math.min(20, Number.parseInt(searchParams.get("topK") ?? String(brainConfig.topK), 10)));
    const matches = await retrieve(q, {
      campaign: searchParams.get("campaign") ?? "All",
      topK,
      visibility: "players",
    });

    const publicMatches = matches.map((match) => ({
      text: match.text,
      score: Number((match.score ?? 0).toFixed(4)),
      semanticScore: Number((match.semanticScore ?? 0).toFixed(4)),
      lexicalScore: Number((match.lexicalScore ?? 0).toFixed(4)),
      directScore: Number((match.directScore ?? 0).toFixed(4)),
      source: {
        title: match.metadata.title,
        path: match.metadata.path,
        heading: match.metadata.heading,
        campaign: match.metadata.campaign,
      },
    }));

    return NextResponse.json({ matches: publicMatches });
  } catch (error) {
    console.error("[Brain Search]", error);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
