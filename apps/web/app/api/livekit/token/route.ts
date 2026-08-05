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
  getAssistantMishearings,
  getAssistantPronunciations,
  getAssistantRecaps,
} from "@/lib/assistantBrain";
import { getAssistantRoadmap } from "@/lib/assistantRoadmap";
import { getLearnedFaqForAgent } from "@/lib/assistantLearned";
import { personaForAgentMember } from "@/lib/assistantPersonaStore";
import { assistantTuningForAgent } from "@/lib/assistantTuningStore";
import { fetchUpcomingCalendarEvents } from "@/lib/calendar";
import { getNavConfig } from "@/lib/nav";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { startVoiceSession } from "@/lib/voiceAnalytics";
import { getUserProfileContext } from "@/lib/userProfiles";
import { isStorefrontEnabled } from "@/lib/store";
import { getMyraHealth, publicHealthSummary } from "@/lib/myraHealth";
import { getWebsiteUpdates } from "@/lib/websiteUpdates";
import { createMyraBrainAccessToken, mayUseFullMyraDm } from "@/lib/myraBrainAccess";
import { getDungeonMasters } from "@/lib/dungeonMasters";
import { getActiveCampaigns } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

/** Bound and validate the browser-supplied page context before it reaches the agent. */
function sanitizePageContext(raw: unknown): { path: string; title: string; subject: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as { path?: unknown; title?: unknown; subject?: unknown };
  const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
  const path = text(candidate.path, 200);
  // Internal absolute paths only — never a protocol-relative or external URL.
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return { path, title: text(candidate.title, 120), subject: text(candidate.subject, 120) };
}

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
      page?: unknown;
    };
    const welcomeKind =
      requestBody.welcomeKind === "new" || requestBody.welcomeKind === "returning"
        ? requestBody.welcomeKind
        : "none";
    // Which page the visitor had open when they tapped the mic, so "tell me
    // about this" works on the very first question. Only an internal absolute
    // path is accepted — the agent renders this into its prompt, so it is
    // untrusted browser input and is bounded and validated here as well.
    const page = sanitizePageContext(requestBody.page);
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
    const fullDmAccess = mayUseFullMyraDm(userSession.email);
    const memberDm = getDungeonMasters().find((dm) =>
      [userProfile.profile.playerName, userProfile.profile.displayName].some((name) =>
        name?.localeCompare(dm.name, undefined, { sensitivity: "base" }) === 0
      )
    );
    const activeCampaigns = getActiveCampaigns();
    const brainNameByCampaignId: Record<string, string> = {
      "heroes-of-emberstran": "Heroes of Emberstran",
      "souls-of-destiny": "Souls of Destiny",
      "the-silent-vanguard": "The Silent Vanguard",
      "bloody-endeavor": "Bloody Endeavor",
      "dungeons-iii": "Dungeons III",
      "the-crystal-bottle": "The Crystal Bottle",
    };
    const dmCampaigns = fullDmAccess
      ? "*" as const
      : Array.from(new Set((memberDm?.activeCampaignIds ?? []).flatMap((campaignId) => {
          const campaign = activeCampaigns.find((item) => item.id === campaignId);
          return [campaign?.name, brainNameByCampaignId[campaignId]].filter((name): name is string => Boolean(name));
        })));
    const dmDefaultCampaigns = fullDmAccess ? [] : (memberDm?.activeCampaignIds ?? []).map((campaignId) =>
      brainNameByCampaignId[campaignId]
      ?? activeCampaigns.find((item) => item.id === campaignId)?.name
    ).filter((name): name is string => Boolean(name));
    const dmBrainAccess = createMyraBrainAccessToken(memberKey, dmCampaigns, apiSecret);
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
    const websiteUpdates = getWebsiteUpdates(
      process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_TIMEZONE ?? "America/New_York",
    );
    const health = publicHealthSummary(await getMyraHealth().catch(() => ({
      overallStatus: "unknown" as const,
      summary: "Myra can respond, but her diagnostic service is unavailable.",
      checkedAt: new Date().toISOString(), cacheAgeMs: 0, uptime: 0,
      version: "unknown", environment: process.env.NODE_ENV ?? "unknown",
      capabilities: {}, diagnostics: [], activeIncidents: [], incidentHistory: [],
      websiteUpdates,
    })));
    const metadata = JSON.stringify({
      purpose: "Questions for Myra, the Suwanee Gamers assistant",
      timezone: process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_TIMEZONE ?? "America/New_York",
      generatedAt: new Date().toISOString(),
      voiceSessionId,
      memberName,
      welcomeKind,
      persona,
      page,
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
      // Separate out-of-world compartment: the website roadmap (site features
      // requested / built / ideated), never mixed with in-world Myrdae lore.
      roadmap: getAssistantRoadmap(),
      knowledgeVisibility: dmBrainAccess ? "dm" : "players",
      dmCampaigns,
      dmDefaultCampaigns,
      brainAccessToken: dmBrainAccess,
      pronunciations: getAssistantPronunciations(),
      mishearings: getAssistantMishearings(),
      recaps: getAssistantRecaps(),
      faq: getLearnedFaqForAgent(),
      tuning: assistantTuningForAgent(),
      health,
      websiteUpdates: health.websiteUpdates,
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
