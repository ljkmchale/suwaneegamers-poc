import { NextRequest, NextResponse } from "next/server";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { isMachineRequest } from "@/lib/machineAuth";
import { answerQuestion, retrieve } from "@/lib/brain/query";
import { hasIndex } from "@/lib/brain/vector-store";
import { brainConfig } from "@/lib/brain/config";
import path from "node:path";
import fs from "node:fs/promises";
import { getAdminSession } from "@/lib/adminSession";
import { tokenAllowsCampaign, verifyMyraBrainAccessToken } from "@/lib/myraBrainAccess";

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
  // two kinds of caller: signed-in members in /advents_of_harmony, and the LiveKit voice
  // agent, which has no browser session. Authorization therefore happens here.
  if (!isMachineRequest(request) && !isSignedIn(await getUserSession())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const question = String(body.question ?? "").trim();
    if (!question) return NextResponse.json({ error: "Missing question." }, { status: 400 });
    if (!(await hasIndex())) return NextResponse.json({ error: "Index not found. Run npm run index first." }, { status: 409 });

    // DM visibility requires either an authenticated admin session or the
    // short-lived capability minted for an explicitly allowlisted Myra user.
    const requestedVisibility = String(body.visibility ?? "players");
    const hasAdminSession = (await getAdminSession()).isAdmin === true;
    const myraAccess = isMachineRequest(request)
      ? verifyMyraBrainAccessToken(request.headers.get("x-sg-myra-brain-access"))
      : null;
    const hasMyraDmAccess = tokenAllowsCampaign(myraAccess, String(body.campaign ?? "All"));
    const isDm = requestedVisibility === "dm" && (hasAdminSession || hasMyraDmAccess);
    const visibility = isDm ? "dm" : "players";

    const topK = Math.max(3, Math.min(20, Number.parseInt(String(body.topK ?? brainConfig.topK), 10)));

    // Retrieval-only mode: return the ranked source excerpts WITHOUT running the
    // Brain's own chat model to compose an answer. This is the lean path a caller
    // that already has an LLM (Myra) can use — she retrieves here and composes the
    // spoken answer in her own Claude turn, dropping one model call per question.
    if (body.retrieveOnly === true || body.mode === "retrieve") {
      const matches = await retrieve(question, {
        campaign: String(body.campaign ?? "All"),
        topK,
        visibility,
      });
      const trimmed = matches.slice(0, topK).map((m) => ({
        text: m.text,
        score: Number((m.score ?? 0).toFixed(4)),
        source: {
          title: m.metadata.title,
          path: m.metadata.path,
          heading: m.metadata.heading,
          campaign: m.metadata.campaign,
        },
      }));
      return NextResponse.json({ matches: trimmed, sources: trimmed.map((t) => t.source) });
    }

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
