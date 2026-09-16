import "server-only";

import { getDb } from "@/lib/db";

export type MemberUnblockRequestStatus = "pending" | "approved" | "declined";

export interface MemberUnblockRequest {
  email: string;
  message: string | null;
  status: MemberUnblockRequestStatus;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

interface MemberUnblockRequestRow {
  email: string;
  message: string | null;
  status: MemberUnblockRequestStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

function mapRequest(row: MemberUnblockRequestRow): MemberUnblockRequest {
  return {
    email: row.email,
    message: row.message,
    status: row.status,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  };
}

export function listPendingMemberUnblockRequests(): MemberUnblockRequest[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM member_unblock_requests
       WHERE status = 'pending'
       ORDER BY requested_at ASC`,
    )
    .all() as MemberUnblockRequestRow[];
  return rows.map(mapRequest);
}

export function getMemberUnblockRequest(email: string): MemberUnblockRequest | null {
  const row = getDb()
    .prepare(`SELECT * FROM member_unblock_requests WHERE email = lower(?)`)
    .get(email.trim()) as MemberUnblockRequestRow | undefined;
  return row ? mapRequest(row) : null;
}

/** Submit a new request or return a previously resolved request to pending. */
export function requestMemberUnblock(email: string, message?: string | null): void {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedMessage = message?.trim().slice(0, 1000) || null;
  getDb()
    .prepare(
      `INSERT INTO member_unblock_requests
         (email, message, status, requested_at, reviewed_at, reviewed_by)
       VALUES (@email, @message, 'pending', @requestedAt, NULL, NULL)
       ON CONFLICT(email) DO UPDATE SET
         message = excluded.message,
         status = 'pending',
         requested_at = excluded.requested_at,
         reviewed_at = NULL,
         reviewed_by = NULL
       WHERE member_unblock_requests.status = 'pending'`,
    )
    .run({
      email: normalizedEmail,
      message: normalizedMessage,
      requestedAt: new Date().toISOString(),
    });
}

export function resolveMemberUnblockRequest(
  email: string,
  status: Exclude<MemberUnblockRequestStatus, "pending">,
  reviewedBy?: string | null,
): void {
  getDb()
    .prepare(
      `UPDATE member_unblock_requests
       SET status = ?, reviewed_at = ?, reviewed_by = ?
       WHERE email = lower(?)`,
    )
    .run(status, new Date().toISOString(), reviewedBy ?? null, email.trim());
}
