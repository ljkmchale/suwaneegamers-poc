import { NextResponse } from "next/server";
import { brainConfig } from "@/lib/brain/config";
import path from "node:path";
import fs from "node:fs/promises";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logPath = path.join(brainConfig.dataDir, "question-log.jsonl");
    let entries: unknown[] = [];
    try {
      const raw = await fs.readFile(logPath, "utf8");
      entries = raw.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    } catch { /* no log yet */ }
    return NextResponse.json({ entries: (entries as unknown[]).reverse().slice(0, 300) });
  } catch (error) {
    console.error("[Brain Admin Question Log]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
