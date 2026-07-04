import { NextRequest, NextResponse } from "next/server";
import {
  normalizeUsageEvent,
  recordUsageEvents,
  type UsageEventInput,
} from "@/lib/analytics";
import { getUserSession, isSignedIn } from "@/lib/userSession";

export const dynamic = "force-dynamic";

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

  recordUsageEvents({
    rawSessionId,
    events,
    referrer: typeof payload.referrer === "string" ? payload.referrer : undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
    identity,
  });
  return new NextResponse(null, { status: 204 });
}
