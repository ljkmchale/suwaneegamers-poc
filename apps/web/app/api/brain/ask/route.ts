import { NextRequest, NextResponse } from "next/server";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { isMachineRequest } from "@/lib/machineAuth";
import { answerQuestion } from "@/lib/brain/query";
import { hasIndex } from "@/lib/brain/vector-store";
import { brainConfig } from "@/lib/brain/config";
import path from "node:path";
import fs from "node:fs/promises";

export const dynamic = "force-dynamic";

function logQuestion(campaign: string, question: string, answer: string, sources: { title: string; score?: number }[]): void {
  const topScore = sources[0]?.score ?? 0;
  const entry = {
    ts: new Date().toISOString(),
    campaign,
    question,
    answer: answer.slice(0, 5000),
    lowConfidence: topScore < 0.45,
    sources: sources.slice(0, 3).map((s) => ({ title: s.title, score: s.score })),
  };
  fs.appendFile(
    path.join(brainConfig.dataDir, "question-log.jsonl"),
    JSON.stringify(entry) + "\n",
    "utf8",
  ).catch(() => {});
}

export async function POST(request: NextRequest) {
  // This route is exempt from the proxy's site-wide sign-in gate because it has
  // two kinds of caller: signed-in members on /chronicles, and the LiveKit voice
  // agent, which has no browser session. Authorization therefore happens here.
  if (!isMachineRequest(request) && !isSignedIn(await getUserSession())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const question = String(body.question ?? "").trim();
    if (!question) return NextResponse.json({ error: "Missing question." }, { status: 400 });
    if (!(await hasIndex())) return NextResponse.json({ error: "Index not found. Run npm run index first." }, { status: 409 });

    // Visibility: only allow "dm" if the caller explicitly requests it via header (admin surface)
    const requestedVisibility = String(body.visibility ?? "players");
    const isDm = requestedVisibility === "dm" && request.headers.get("x-sg-admin") === "1";
    const visibility = isDm ? "dm" : "players";

    const topK = Math.max(3, Math.min(20, Number.parseInt(String(body.topK ?? brainConfig.topK), 10)));
    const result = await answerQuestion(question, {
      campaign: String(body.campaign ?? "All"),
      topK,
      visibility,
      review: body.quality === "deep" ? true : body.quality === "fast" ? false : undefined,
      answerMode: String(body.answerMode ?? "direct"),
      debug: isDm && Boolean(body.debug),
    });

    logQuestion(String(body.campaign ?? "All"), question, result.answer ?? "", result.sources ?? []);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Brain Ask]", error);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
