import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from "livekit-server-sdk";
import { getAssistantBrain } from "@/lib/assistantBrain";
import { fetchUpcomingCalendarEvents } from "@/lib/calendar";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { startVoiceSession } from "@/lib/voiceAnalytics";

export const dynamic = "force-dynamic";

const requestsByAddress = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const REQUEST_LIMIT = 8;

function isRateLimited(request: NextRequest): boolean {
  const address =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const now = Date.now();
  const entry = requestsByAddress.get(address);

  if (!entry || entry.resetAt <= now) {
    requestsByAddress.set(address, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > REQUEST_LIMIT;
}

export async function POST(request: NextRequest) {
  const userSession = await getUserSession();
  if (!isSignedIn(userSession)) {
    return NextResponse.json(
      { error: "Sign in with Google to use the voice assistant." },
      { status: 401 },
    );
  }

  if (isRateLimited(request)) {
    return NextResponse.json(
      { error: "Please wait a moment before starting another voice session." },
      { status: 429 },
    );
  }

  const localDevelopment = process.env.NODE_ENV !== "production";
  const serverUrl =
    process.env.LIVEKIT_URL ?? (localDevelopment ? "ws://127.0.0.1:7880" : undefined);
  const apiKey =
    process.env.LIVEKIT_API_KEY ?? (localDevelopment ? "devkey" : undefined);
  const apiSecret =
    process.env.LIVEKIT_API_SECRET ?? (localDevelopment ? "secret" : undefined);
  const agentName =
    process.env.LIVEKIT_SCHEDULE_AGENT_NAME ?? "suwanee-schedule-assistant";

  if (!serverUrl || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "The LiveKit voice assistant has not been configured yet." },
      { status: 503 },
    );
  }

  try {
    const events = await fetchUpcomingCalendarEvents(20);
    const roomName = `schedule-${randomUUID()}`;
    const voiceSessionId = randomUUID();
    const schedule = events.map(({ title, start, end, allDay, location }) => ({
      title,
      start,
      end,
      allDay,
      location,
    }));
    const metadata = JSON.stringify({
      purpose: "Suwanee Gamers public schedule and site questions",
      timezone: process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_TIMEZONE ?? "America/New_York",
      generatedAt: new Date().toISOString(),
      voiceSessionId,
      events: schedule,
      knowledge: getAssistantBrain(),
    });

    const memberKey = userSession.sub ?? userSession.email ?? randomUUID();
    const memberId = createHash("sha256").update(memberKey).digest("hex").slice(0, 12);
    const token = new AccessToken(apiKey, apiSecret, {
      identity: `member-${memberId}-${randomUUID()}`,
      name: userSession.name ?? "Suwanee Gamers member",
      ttl: "10m",
      metadata: JSON.stringify({
        source: "suwaneegamers-homepage",
        memberId,
      }),
    });
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });
    token.roomConfig = new RoomConfiguration({
      name: roomName,
      maxParticipants: 2,
      agents: [
        new RoomAgentDispatch({
          agentName,
          metadata,
        }),
      ],
    });
    startVoiceSession({
      sessionId: voiceSessionId,
      roomName,
      memberId,
      memberName: userSession.name,
      memberEmail: userSession.email,
    });

    return NextResponse.json({
      serverUrl,
      participantToken: await token.toJwt(),
      voiceSessionId,
    });
  } catch (error) {
    console.error("[LiveKit schedule token]", error);
    return NextResponse.json(
      { error: "The live schedule could not be loaded. Please try again shortly." },
      { status: 502 },
    );
  }
}
