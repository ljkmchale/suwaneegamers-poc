import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { buildAuthUrl, getRedirectUri, isGoogleAuthConfigured } from "@/lib/googleOAuth";

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
  return response;
}
