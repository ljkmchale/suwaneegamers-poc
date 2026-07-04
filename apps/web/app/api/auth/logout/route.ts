import { NextResponse, type NextRequest } from "next/server";
import { getBaseUrl } from "@/lib/googleOAuth";
import { USER_SESSION_OPTIONS } from "@/lib/userSession";

export const dynamic = "force-dynamic";

function signOut(request: NextRequest) {
  // 303 so the form POST becomes a GET on the target; public host, not the
  // internal proxy origin (localhost:4652).
  const response = NextResponse.redirect(new URL("/", getBaseUrl(request)), 303);
  // Clear the session cookie directly on the response.
  response.cookies.set(USER_SESSION_OPTIONS.cookieName, "", {
    ...USER_SESSION_OPTIONS.cookieOptions,
    maxAge: 0,
  });
  return response;
}

export async function POST(request: NextRequest) {
  return signOut(request);
}

export async function GET(request: NextRequest) {
  return signOut(request);
}
