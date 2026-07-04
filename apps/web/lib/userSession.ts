import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface UserSessionData {
  /** Google account subject id (stable per user) */
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

export const USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const USER_SESSION_OPTIONS: SessionOptions = {
  password:
    process.env.ADMIN_SESSION_SECRET ??
    "fallback-dev-secret-change-in-production-32chars",
  cookieName: "sg-user",
  // Keep the seal TTL and cookie lifetime in sync so sessions don't expire early.
  ttl: USER_SESSION_TTL_SECONDS,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    // Sign-in should persist across visits, not just the browser session.
    maxAge: USER_SESSION_TTL_SECONDS,
  },
};

/** Read the signed-in visitor session in server components / server actions. */
export async function getUserSession() {
  const cookieStore = await cookies();
  return getIronSession<UserSessionData>(cookieStore, USER_SESSION_OPTIONS);
}

/** True when a visitor has completed Google sign-in. */
export function isSignedIn(session: UserSessionData): boolean {
  return typeof session.email === "string" && session.email.length > 0;
}
