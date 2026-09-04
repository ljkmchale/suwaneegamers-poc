import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { buildAuthUrl, getRedirectUri, isGoogleAuthConfigured } from "@/lib/googleOAuth";
import { ACQUISITION_COOKIE, RETURN_TO_COOKIE, safeReturnPath } from "@/lib/authRedirect";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isGoogleAuthConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in is not configured on this server." },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = getRedirectUri(request);
  const response = NextResponse.redirect(buildAuthUrl({ redirectUri, state }));

  // Short-lived CSRF guard, verified in the callback.
  response.cookies.set("sg-oauth-state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  // Remember where they were headed before the proxy sent them here. Sanitized
  // to a same-site path so this can never become an open redirect.
  const from = safeReturnPath(request.nextUrl.searchParams.get("from"), "");
  if (from) {
    response.cookies.set(RETURN_TO_COOKIE, from, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }
  const suppliedReferrer = request.nextUrl.searchParams.get("referrer") ?? "";
  const suppliedLanding = request.nextUrl.searchParams.get("landing") ?? "";
  if ((suppliedReferrer || suppliedLanding) && !request.cookies.has(ACQUISITION_COOKIE)) {
    const acquisition = {
      landingPath: safeReturnPath(suppliedLanding, "/signin").slice(0, 500),
      referrer: suppliedReferrer.slice(0, 1000),
      utmSource: (request.nextUrl.searchParams.get("utm_source") ?? "").slice(0, 100),
      utmMedium: (request.nextUrl.searchParams.get("utm_medium") ?? "").slice(0, 100),
      utmCampaign: (request.nextUrl.searchParams.get("utm_campaign") ?? "").slice(0, 160),
    };
    response.cookies.set(ACQUISITION_COOKIE, encodeURIComponent(JSON.stringify(acquisition)), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
  }
  return response;
}
