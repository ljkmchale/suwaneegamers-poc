import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { SESSION_OPTIONS, type AdminSessionData } from "@/lib/adminSession";
import { USER_SESSION_OPTIONS, isSignedIn, type UserSessionData } from "@/lib/userSession";
import { automaticallyBlockThreat, clientIpFromHeaders, isSuspiciousPath, recordSecurityEvent } from "@/lib/securityLog";
import { isVerifiedCloudflareRequest } from "@/lib/cloudflareSecurity";

// Reachable without a signed-in visitor. Everything else — pages and APIs alike
// — requires Google sign-in.
const PUBLIC_PATHS = [
  "/signin", // the gate itself
  "/terms-of-use", // must be readable before a visitor can consent at the gate
  "/privacy-policy", // privacy practices must be readable before Google sign-in
  "/api/auth/", // the sign-in round trip
  "/api/analytics/events", // visit beacon; it also fires on the sign-in page
  "/api/myra/health/summary", // sanitized capability status used by Myra herself
  "/api/version", // non-sensitive identity of the production bundle actually serving
];

// Server-to-server callers that carry their own bearer secret and have no
// browser session: the LiveKit agent posting metrics, and the content scheduler.
const MACHINE_PATHS = [
  "/api/livekit/analytics",
  "/api/livekit/feedback",
  "/api/livekit/metrics",
  "/api/content-scheduler/",
  "/api/myra/health/monitor",
  // Serves both signed-in members in /advents_of_harmony and the voice agent's
  // search_knowledge_base tool, so it authorizes both cases inside the route
  // rather than here. It is NOT public — see app/api/brain/ask/route.ts.
  "/api/brain/ask",
];

// An entry ending in "/" covers everything beneath it; anything else must match
// exactly. Without that rule "/api/brain/ask" would also exempt
// "/api/brain/ask-stream", which has no authorization of its own.
function isPublicPath(pathname: string): boolean {
  return [...PUBLIC_PATHS, ...MACHINE_PATHS].some((entry) =>
    entry.endsWith("/") ? pathname.startsWith(entry) : pathname === entry,
  );
}

// Mirrors lib/googleOAuth.ts: sign-in is only *enforced* once real credentials
// exist, so a server without OAuth configured is never locked out of itself.
function googleAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The Chronicles admin API lives outside /admin, so it needs its own gate.
  // API callers get a 401 instead of a login-page redirect.
  if (pathname.startsWith("/api/brain/admin")) {
    const response = NextResponse.next();
    const session = await getIronSession<AdminSessionData>(request, response, SESSION_OPTIONS);
    if (session.isAdmin !== true) {
      recordSecurityEvent({
        kind: "admin_request",
        path: pathname,
        method: request.method,
        ip: clientIpFromHeaders(request.headers),
        userAgent: request.headers.get("user-agent"),
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return response;
  }

  if (!pathname.startsWith("/admin")) {
    // Site-wide watch: only vulnerability-scanner-looking paths are logged,
    // so normal page traffic never touches the database.
    if (isSuspiciousPath(pathname)) {
      const ip = clientIpFromHeaders(request.headers);
      recordSecurityEvent({
        kind: "suspicious_request",
        path: pathname,
        method: request.method,
        ip,
        userAgent: request.headers.get("user-agent"),
      });
      if (isVerifiedCloudflareRequest(request.headers)) await automaticallyBlockThreat(ip);
    }

    if (!googleAuthConfigured() || isPublicPath(pathname)) {
      const requestHeaders = new Headers(request.headers);
      if (pathname === "/terms-of-use" || pathname === "/privacy-policy") {
        requestHeaders.set("x-sg-public-legal-page", "1");
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // The whole site is members-only. This has to happen here rather than in a
    // layout: React renders the layout and the page in parallel, so a layout
    // that swaps in the sign-in screen still ships the page's rendered payload
    // in the same HTML response. Stopping the request is the only way the
    // content never leaves the server.
    const response = NextResponse.next();
    const userSession = await getIronSession<UserSessionData>(
      request,
      response,
      USER_SESSION_OPTIONS,
    );
    if (isSignedIn(userSession)) return response;

    // API callers get a status they can act on; browsers get the sign-in page,
    // carrying where they were headed so the deep link survives the round trip.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const signInUrl = new URL("/signin", request.url);
    if (pathname !== "/") signInUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-admin-path", pathname);

  // Allow password entry through
  if (pathname === "/admin/login") {
    requestHeaders.set("x-admin-login-page", "1");
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  const session = await getIronSession<AdminSessionData>(request, response, SESSION_OPTIONS);

  if (session.isAdmin !== true) {
    // Unauthenticated hit on a protected admin route — worth a log line.
    // Authenticated admin activity is not recorded.
    recordSecurityEvent({
      kind: "admin_request",
      path: pathname,
      method: request.method,
      ip: clientIpFromHeaders(request.headers),
      userAgent: request.headers.get("user-agent"),
    });
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico|images/|media/|fonts/).*)"],
};
