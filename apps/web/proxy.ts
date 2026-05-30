import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { SESSION_OPTIONS, type AdminSessionData } from "@/lib/adminSession";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow password entry through
  if (pathname === "/admin/login") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-admin-login-page", "1");
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const response = NextResponse.next();
  const session = await getIronSession<AdminSessionData>(request, response, SESSION_OPTIONS);

  if (session.isAdmin !== true) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
