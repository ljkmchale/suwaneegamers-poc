import { NextResponse } from "next/server";
import { cacheStats, clearCache } from "@/lib/brain/query-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await cacheStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[Brain Admin Query Cache Stats]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Brain Admin Clear Cache]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
