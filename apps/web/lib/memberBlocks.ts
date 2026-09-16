import "server-only";

import { getDb } from "@/lib/db";

export interface MemberBlock {
  email: string;
  displayName: string | null;
  reason: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface MemberBlockRow {
  email: string;
  display_name: string | null;
  reason: string | null;
  created_at: string;
  created_by: string | null;
}

function mapBlock(row: MemberBlockRow): MemberBlock {
  return {
    email: row.email,
    displayName: row.display_name,
    reason: row.reason,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/** Every member currently barred from signing in, newest first. */
export function listMemberBlocks(): MemberBlock[] {
  const rows = getDb()
    .prepare(`SELECT * FROM member_blocks ORDER BY created_at DESC`)
    .all() as MemberBlockRow[];
  return rows.map(mapBlock);
}

/** True when this email is blocked. Checked on every signed-in request in proxy.ts. */
export function isMemberBlocked(email: string): boolean {
  const row = getDb()
    .prepare(`SELECT 1 FROM member_blocks WHERE email = lower(?)`)
    .get(email.trim());
  return Boolean(row);
}

/** Bar a member from the site. Idempotent — re-blocking updates the reason/name. */
export function blockMember(input: {
  email: string;
  displayName?: string | null;
  reason?: string | null;
  createdBy?: string | null;
}): void {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("An email address is required to block a member.");
  getDb()
    .prepare(
      `INSERT INTO member_blocks (email, display_name, reason, created_at, created_by)
       VALUES (@email, @displayName, @reason, @createdAt, @createdBy)
       ON CONFLICT(email) DO UPDATE SET
         display_name = excluded.display_name,
         reason = excluded.reason,
         created_at = excluded.created_at,
         created_by = excluded.created_by`,
    )
    .run({
      email,
      displayName: input.displayName ?? null,
      reason: input.reason ?? null,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy ?? null,
    });
}

/** Lift a block. No-op if the email was not blocked. */
export function unblockMember(email: string): void {
  getDb().prepare(`DELETE FROM member_blocks WHERE email = lower(?)`).run(email.trim());
}
