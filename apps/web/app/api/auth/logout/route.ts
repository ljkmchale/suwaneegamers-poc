import { NextResponse, type NextRequest } from "next/server";
import { SESSION_OPTIONS } from "@/lib/adminSession";
import { getBaseUrl } from "@/lib/googleOAuth";
import { USER_SESSION_OPTIONS } from "@/lib/userSession";

export const dynamic = "force-dynamic";

function signOut(request: NextRequest) {
  // 303 so the form POST becomes a GET on the target; public host, not the
  // internal proxy origin (localhost:4652).
  const response = NextResponse.redirect(new URL("/signin", getBaseUrl(request)), 303);
  // Site sign-out must clear both identities. Otherwise an old admin session
  // still passes the proxy's admin bypass after the Google session is removed.
  response.cookies.set(USER_SESSION_OPTIONS.cookieName, "", {
    ...USER_SESSION_OPTIONS.cookieOptions,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(SESSION_OPTIONS.cookieName, "", {
    ...SESSION_OPTIONS.cookieOptions,
    path: "/",
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
