import { NextResponse, type NextRequest } from "next/server";
import { sealData } from "iron-session";
import { USER_SESSION_OPTIONS, USER_SESSION_TTL_SECONDS, type UserSessionData } from "@/lib/userSession";
import { exchangeCodeForIdentity, getBaseUrl, getRedirectUri, isGoogleAuthConfigured } from "@/lib/googleOAuth";

export const dynamic = "force-dynamic";

function homeUrl(request: NextRequest) {
  // Public host from proxy headers, never the internal origin (localhost:4652).
  return new URL("/", getBaseUrl(request));
}

function failure(request: NextRequest, reason: string) {
  const response = NextResponse.redirect(homeUrl(request));
  response.cookies.set("sg-auth-error", reason, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30,
  });
  return response;
}

export async function GET(request: NextRequest) {
  if (!isGoogleAuthConfigured()) return failure(request, "not_configured");

  const { searchParams } = request.nextUrl;
  if (searchParams.get("error")) return failure(request, "denied");

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("sg-oauth-state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) return failure(request, "state");

  let identity;
  try {
    identity = await exchangeCodeForIdentity({ code, redirectUri: getRedirectUri(request) });
  } catch {
    return failure(request, "exchange");
  }

  // Seal the session and set it directly on the response. iron-session's
  // (request, response) writer did not survive the proxy here, so we write the
  // cookie the same way the (working) state cookie is written.
  const sealed = await sealData(
    {
      sub: identity.sub,
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
    } satisfies UserSessionData,
    { password: USER_SESSION_OPTIONS.password as string, ttl: USER_SESSION_TTL_SECONDS },
  );

  const response = NextResponse.redirect(homeUrl(request));
  response.cookies.set(USER_SESSION_OPTIONS.cookieName, sealed, {
    ...USER_SESSION_OPTIONS.cookieOptions,
    maxAge: USER_SESSION_TTL_SECONDS,
  });
  response.cookies.delete("sg-oauth-state");
  response.cookies.delete("sg-auth-error");
  return response;
}
