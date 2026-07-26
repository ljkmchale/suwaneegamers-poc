import { NextRequest, NextResponse } from "next/server";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { endVoiceSession } from "@/lib/voiceAnalytics";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSignedIn(await getUserSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as { voiceSessionId?: string };
  if (!body.voiceSessionId) {
    return NextResponse.json({ error: "Missing voice session" }, { status: 400 });
  }
  endVoiceSession(body.voiceSessionId);
  return NextResponse.json({ ok: true });
}
