import { NextRequest, NextResponse } from "next/server";
import {
  normalizeUsageEvent,
  recordUsageEvents,
  type UsageEventInput,
} from "@/lib/analytics";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { ACQUISITION_COOKIE } from "@/lib/authRedirect";

export const dynamic = "force-dynamic";

function cleanAcquisition(value: unknown) {
  try {
    const parsed = value as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return undefined;
    const text = (key: string, max: number) => typeof parsed[key] === "string"
      ? parsed[key].slice(0, max)
      : undefined;
    return {
      landingPath: text("landingPath", 500),
      referrer: text("referrer", 1000),
      utmSource: text("utmSource", 100),
      utmMedium: text("utmMedium", 100),
      utmCampaign: text("utmCampaign", 160),
    };
  } catch {
    return undefined;
  }
}

function readAcquisition(request: NextRequest) {
  const raw = request.cookies.get(ACQUISITION_COOKIE)?.value;
  if (!raw) return undefined;
  try {
    return cleanAcquisition(JSON.parse(decodeURIComponent(raw)));
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && forwardedHost) {
    try {
      if (new URL(origin).host !== forwardedHost) {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  const rawSessionId = typeof payload.sessionId === "string"
    ? payload.sessionId.trim().slice(0, 100)
    : "";
  const rawVisitorId = typeof payload.visitorId === "string"
    ? payload.visitorId.trim().slice(0, 100)
    : "";
  if (rawSessionId.length < 16) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const rawEvents = Array.isArray(payload.events) ? payload.events.slice(0, 20) : [];
  const events = rawEvents
    .map(normalizeUsageEvent)
    .filter((event): event is UsageEventInput => event !== null);
  if (events.length === 0) {
    return NextResponse.json({ error: "No valid events" }, { status: 400 });
  }

  // Identity is read from the signed-in session server-side, never from the
  // client payload, so it cannot be spoofed.
  const userSession = await getUserSession();
  const identity = isSignedIn(userSession)
    ? { email: userSession.email, name: userSession.name }
    : undefined;

  const cookieAcquisition = readAcquisition(request);
  const acquisition = cookieAcquisition ?? cleanAcquisition(payload.acquisition);
  recordUsageEvents({
    rawSessionId,
    rawVisitorId: rawVisitorId.length >= 16 ? rawVisitorId : undefined,
    events,
    referrer: acquisition?.referrer || (typeof payload.referrer === "string" ? payload.referrer : undefined),
    acquisition,
    userAgent: request.headers.get("user-agent") ?? undefined,
    identity,
  });
  const response = new NextResponse(null, { status: 204 });
  if (cookieAcquisition) response.cookies.delete(ACQUISITION_COOKIE);
  return response;
}
