import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { SESSION_OPTIONS, type AdminSessionData } from "@/lib/adminSession";
import { clientIpFromHeaders, isSuspiciousPath, recordSecurityEvent } from "@/lib/securityLog";

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
      recordSecurityEvent({
        kind: "suspicious_request",
        path: pathname,
        method: request.method,
        ip: clientIpFromHeaders(request.headers),
        userAgent: request.headers.get("user-agent"),
      });
    }
    return NextResponse.next();
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
