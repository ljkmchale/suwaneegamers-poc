import "server-only";

import { getDb } from "@/lib/db";
import { pruneExpired } from "@/lib/retention";

const RETENTION_DAYS = 180;

export interface MemberSignin {
  id: number;
  createdAt: string;
  googleSub: string;
  email: string;
  displayName: string | null;
  ip: string | null;
  userAgent: string | null;
}

export function recordMemberSignin(input: {
  googleSub: string;
  email: string;
  displayName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO member_signins (created_at, google_sub, email, display_name, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      new Date().toISOString(),
      input.googleSub,
      input.email,
      input.displayName ?? null,
      input.ip ?? null,
      input.userAgent?.slice(0, 300) ?? null,
    );
    pruneExpired([{ table: "member_signins", column: "created_at", days: RETENTION_DAYS }]);
  } catch (error) {
    // Logging must never break sign-in.
    console.error("[memberSignins] failed to record sign-in", error);
  }
}

interface MemberSigninRow {
  id: number;
  created_at: string;
  google_sub: string;
  email: string;
  display_name: string | null;
  ip: string | null;
  user_agent: string | null;
}

export function getRecentMemberSignins(options?: { days?: number; limit?: number }): MemberSignin[] {
  const days = options?.days ?? 7;
  const limit = options?.limit ?? 100;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const rows = getDb()
    .prepare(
      `SELECT * FROM member_signins WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(cutoff, limit) as MemberSigninRow[];

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    googleSub: row.google_sub,
    email: row.email,
    displayName: row.display_name,
    ip: row.ip,
    userAgent: row.user_agent,
  }));
}
