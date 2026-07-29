import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from "livekit-server-sdk";
import {
  getAssistantAbout,
  getAssistantBrain,
  getAssistantPronunciations,
  getAssistantRecaps,
} from "@/lib/assistantBrain";
import { getLearnedFaqForAgent } from "@/lib/assistantLearned";
import { personaForAgentMember } from "@/lib/assistantPersonaStore";
import { assistantTuningForAgent } from "@/lib/assistantTuningStore";
import { fetchUpcomingCalendarEvents } from "@/lib/calendar";
import { getNavConfig } from "@/lib/nav";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { startVoiceSession } from "@/lib/voiceAnalytics";
import { getUserProfileContext } from "@/lib/userProfiles";
import { isStorefrontEnabled } from "@/lib/store";

export const dynamic = "force-dynamic";

const requestsByAddress = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const REQUEST_LIMIT = 8;
// Guard against unbounded growth: one-time visitors would otherwise leave a
// permanent entry. When the map gets large, drop everything already expired.
const SWEEP_THRESHOLD = 512;

function isRateLimited(request: NextRequest): boolean {
  const address =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const now = Date.now();

  if (requestsByAddress.size > SWEEP_THRESHOLD) {
    for (const [key, value] of requestsByAddress) {
      if (value.resetAt <= now) requestsByAddress.delete(key);
    }
  }

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
      { error: "Sign in with Google to talk with Myra." },
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
    process.env.LIVEKIT_SCHEDULE_AGENT_NAME ?? "myra";

  if (!serverUrl || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Myra has not been configured yet." },
      { status: 503 },
    );
  }

  try {
    const requestBody = (await request.json().catch(() => ({}))) as {
      welcomeKind?: unknown;
    };
    const welcomeKind =
      requestBody.welcomeKind === "new" || requestBody.welcomeKind === "returning"
        ? requestBody.welcomeKind
        : "none";
    const userProfile = getUserProfileContext(userSession);
    // How Myra sounds and behaves for this member: their chosen persona, or the
    // one that names them, or the house default.
    const persona = personaForAgentMember({
      personaId: userProfile.profile.myraPersona,
      playerName: userProfile.profile.playerName,
      displayName: userProfile.profile.displayName,
    });
    const events = await fetchUpcomingCalendarEvents(20);
    const roomName = `schedule-${randomUUID()}`;
    const voiceSessionId = randomUUID();
    const memberName =
      userProfile.profile.displayName.trim().split(/\s+/)[0] || "there";
    const memberKey = userSession.sub ?? userSession.email ?? randomUUID();
    const memberId = createHash("sha256").update(memberKey).digest("hex").slice(0, 12);
    const schedule = events.map(({ title, start, end, allDay, location }) => ({
      title,
      start,
      end,
      allDay,
      location,
    }));
    const navigation = [
      { label: "Home", href: "/" },
      { label: "Calendar", href: "/calendar" },
      { label: "My Profile", href: "/profile" },
      ...(isStorefrontEnabled() ? [{ label: "Store", href: "/store" }] : []),
      ...getNavConfig().sections.flatMap((section) => section.items),
    ]
      .filter((item) => item.href.startsWith("/") && !item.href.startsWith("//"))
      .filter(
        (item, index, items) =>
          items.findIndex((candidate) => candidate.href === item.href) === index,
      )
      .map(({ label, href }) => ({ label, href }));
    const metadata = JSON.stringify({
      purpose: "Questions for Myra, the Suwanee Gamers assistant",
      timezone: process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_TIMEZONE ?? "America/New_York",
      generatedAt: new Date().toISOString(),
      voiceSessionId,
      memberName,
      welcomeKind,
      persona,
      userProfile: {
        displayName: userProfile.profile.displayName,
        playerName: userProfile.profile.playerName ?? "",
        favoriteLocations: userProfile.favoriteLocations.map((location) => location.label),
        games: userProfile.games,
        characters: userProfile.characters,
      },
      events: schedule,
      navigation,
      aboutSuwaneeGamers: getAssistantAbout(),
      knowledge: getAssistantBrain(),
      pronunciations: getAssistantPronunciations(),
      recaps: getAssistantRecaps(),
      faq: getLearnedFaqForAgent(),
      tuning: assistantTuningForAgent(),
    });

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
