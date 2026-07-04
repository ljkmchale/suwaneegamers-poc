import { NextRequest, NextResponse } from "next/server";
import { streamAnswer } from "@/lib/brain/query";
import type { QuerySource } from "@/lib/brain/query";
import { hasIndex } from "@/lib/brain/vector-store";
import { brainConfig } from "@/lib/brain/config";
import path from "node:path";
import fs from "node:fs/promises";

export const dynamic = "force-dynamic";

function logQuestion(campaign: string, question: string, answer: string, sources: QuerySource[]): void {
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
  try {
    const body = await request.json() as Record<string, unknown>;
    const question = String(body.question ?? "").trim();
    if (!question) return NextResponse.json({ error: "Missing question." }, { status: 400 });
    if (!(await hasIndex())) return NextResponse.json({ error: "Index not found. Run npm run index first." }, { status: 409 });

    // Public surface: always force players visibility on this route
    const topK = Math.max(3, Math.min(20, Number.parseInt(String(body.topK ?? brainConfig.topK), 10)));
    const campaign = String(body.campaign ?? "All");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown): void => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          let fullAnswer = "";
          await streamAnswer(
            question,
            { campaign, topK, visibility: "players", answerMode: String(body.answerMode ?? "direct") },
            {
              onToken: (token) => { fullAnswer += token; send({ token }); },
              onDone: (sources, debug, finalAnswer) => {
                const answerForLog = finalAnswer || fullAnswer;
                logQuestion(campaign, question, answerForLog, sources ?? []);
                send({ done: true, sources, debug, answer: finalAnswer });
                controller.close();
              },
            },
          );
        } catch (error) {
          send({ error: (error as Error).message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[Brain Ask Stream]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
