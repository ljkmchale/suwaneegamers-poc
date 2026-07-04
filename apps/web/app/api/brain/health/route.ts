import { NextResponse } from "next/server";
import { indexStats } from "@/lib/brain/vector-store";
import { aiHealth } from "@/lib/brain/ai-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const [index, ai] = await Promise.all([
    indexStats(),
    aiHealth().catch((error: Error) => ({ ok: false, error: error.message })),
  ]);
  return NextResponse.json({ ok: index.exists && ai.ok, index, ai });
}
