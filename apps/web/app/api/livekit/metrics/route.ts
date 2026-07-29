import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { recordVoiceMetric } from "@/lib/voiceMetrics";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const expected = process.env.LIVEKIT_API_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    recordVoiceMetric(await request.json());
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Voice metrics]", error);
    return NextResponse.json({ error: "Invalid voice metric event" }, { status: 400 });
  }
}
