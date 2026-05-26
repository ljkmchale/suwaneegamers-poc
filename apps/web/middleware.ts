import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { SESSION_OPTIONS, type AdminSessionData } from "@/lib/adminSession";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page through
  if (pathname === "/admin/login") return NextResponse.next();

  const response = NextResponse.next();
  const session = await getIronSession<AdminSessionData>(request, response, SESSION_OPTIONS);

  if (!session.isAdmin) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
