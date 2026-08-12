import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { getAdminSession } from "@/lib/adminSession";
import { getBaseUrl, isGoogleAuthConfigured } from "@/lib/googleOAuth";
import { buildDriveConsentUrl } from "@/lib/googleUserToken";

export const dynamic = "force-dynamic";

const CALLBACK_PATH = "/api/admin/google-drive/callback";

/**
 * One-time consent kickoff: sends the (admin) owner to Google to grant the site
 * offline Drive read access. Admin-gated — only the site owner can bind their
 * own Google account for the scheduler to read privately-shared docs as.
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 403 });
  }
  if (!isGoogleAuthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured (GOOGLE_CLIENT_ID/SECRET)." },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${getBaseUrl(request)}${CALLBACK_PATH}`;
  const response = NextResponse.redirect(buildDriveConsentUrl({ redirectUri, state }));
  response.cookies.set("sg-drive-oauth-state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
