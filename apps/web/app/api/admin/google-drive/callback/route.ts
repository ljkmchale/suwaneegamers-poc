import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { getBaseUrl, isGoogleAuthConfigured } from "@/lib/googleOAuth";
import { completeDriveConsent } from "@/lib/googleUserToken";

export const dynamic = "force-dynamic";

const CALLBACK_PATH = "/api/admin/google-drive/callback";

function result(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin/source-managed", getBaseUrl(request));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * Consent callback: exchanges the code for a refresh token and stores it, so
 * the scheduler can later read Drive docs as this account. Admin-gated and
 * state-checked; Google redirects the owner's authenticated browser here.
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 403 });
  }
  if (!isGoogleAuthConfigured()) {
    return result(request, { drive: "error", reason: "not_configured" });
  }

  const { searchParams } = request.nextUrl;
  if (searchParams.get("error")) {
    return result(request, { drive: "error", reason: "denied" });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("sg-drive-oauth-state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return result(request, { drive: "error", reason: "state" });
  }

  try {
    const { accountEmail } = await completeDriveConsent({
      code,
      redirectUri: `${getBaseUrl(request)}${CALLBACK_PATH}`,
    });
    const response = result(request, {
      drive: "connected",
      ...(accountEmail ? { account: accountEmail } : {}),
    });
    response.cookies.delete("sg-drive-oauth-state");
    return response;
  } catch (error) {
    return result(request, {
      drive: "error",
      reason: error instanceof Error ? error.message.slice(0, 120) : "exchange",
    });
  }
}
