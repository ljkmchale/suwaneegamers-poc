import { NextRequest, NextResponse } from "next/server";
import { brainConfig } from "@/lib/brain/config";
import path from "node:path";
import fs from "node:fs/promises";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const question = String(body.question ?? "").trim();
    const answer = String(body.answer ?? "").trim();
    const correction = String(body.correction ?? "").trim();
    const sources = Array.isArray(body.sources) ? body.sources : [];
    const debug = body.debug && typeof body.debug === "object" ? body.debug : null;

    if (!question || !answer) return NextResponse.json({ error: "Missing question or answer." }, { status: 400 });
    if (!correction) return NextResponse.json({ error: "Add what should be fixed or tested." }, { status: 400 });

    await fs.mkdir(brainConfig.dataDir, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      campaign: String(body.campaign ?? "All"),
      question,
      answer: answer.slice(0, 8000),
      correction: correction.slice(0, 4000),
      sources,
      debug,
    };
    await fs.appendFile(path.join(brainConfig.dataDir, "answer-feedback.jsonl"), JSON.stringify(entry) + "\n", "utf8");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Brain Admin Answer Feedback]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
