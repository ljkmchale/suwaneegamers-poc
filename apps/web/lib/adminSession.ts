import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface AdminSessionData {
  isAdmin?: boolean;
}

export const SESSION_OPTIONS: SessionOptions = {
  password: process.env.ADMIN_SESSION_SECRET ?? "fallback-dev-secret-change-in-production-32chars",
  cookieName: "sg-admin",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export async function getAdminSession() {
  const cookieStore = await cookies();
  return getIronSession<AdminSessionData>(cookieStore, SESSION_OPTIONS);
}
