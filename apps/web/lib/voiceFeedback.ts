import "server-only";

import { getDb } from "@/lib/db";

export type FeedbackKind = "wish" | "complaint" | "praise";
export type FeedbackStatus = "new" | "reviewed" | "done" | "dismissed";

const KINDS: readonly FeedbackKind[] = ["wish", "complaint", "praise"];
const STATUSES: readonly FeedbackStatus[] = ["new", "reviewed", "done", "dismissed"];

export type FeedbackEntry = {
  id: number;
  sessionId: string | null;
  createdAt: string;
  kind: FeedbackKind;
  message: string;
  memberName: string | null;
  memberEmail: string | null;
  pagePath: string | null;
  status: FeedbackStatus;
};

function clean(value: unknown, length: number): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, length)
    : "";
}

/**
 * Store a piece of user feedback Myra captured. Called from the machine-authed
 * feedback API route; the agent decides what counts as feedback.
 */
export function recordVoiceFeedback(input: {
  sessionId?: unknown;
  kind: unknown;
  message: unknown;
  memberName?: unknown;
  memberEmail?: unknown;
  pagePath?: unknown;
}): void {
  const message = clean(input.message, 800);
  if (!message) throw new Error("Missing feedback message");
  const kind = KINDS.includes(input.kind as FeedbackKind)
    ? (input.kind as FeedbackKind)
    : "wish";
  getDb()
    .prepare(
      `INSERT INTO voice_feedback
         (session_id, created_at, kind, message, member_name, member_email, page_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`,
    )
    .run(
      clean(input.sessionId, 100) || null,
      new Date().toISOString(),
      kind,
      message,
      clean(input.memberName, 120) || null,
      clean(input.memberEmail, 200) || null,
      clean(input.pagePath, 300) || null,
    );
}

export function listVoiceFeedback(options: { includeResolved?: boolean } = {}): FeedbackEntry[] {
  const where = options.includeResolved ? "" : "WHERE status IN ('new', 'reviewed')";
  const rows = getDb()
    .prepare(
      `SELECT id, session_id, created_at, kind, message, member_name, member_email, page_path, status
         FROM voice_feedback
         ${where}
         ORDER BY created_at DESC
         LIMIT 500`,
    )
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    sessionId: (row.session_id as string) ?? null,
    createdAt: String(row.created_at),
    kind: (row.kind as FeedbackKind) ?? "wish",
    message: String(row.message),
    memberName: (row.member_name as string) ?? null,
    memberEmail: (row.member_email as string) ?? null,
    pagePath: (row.page_path as string) ?? null,
    status: (row.status as FeedbackStatus) ?? "new",
  }));
}

export function feedbackCounts(): Record<FeedbackStatus | "total", number> {
  const rows = getDb()
    .prepare(`SELECT status, COUNT(*) AS n FROM voice_feedback GROUP BY status`)
    .all() as { status: string; n: number }[];
  const counts = { new: 0, reviewed: 0, done: 0, dismissed: 0, total: 0 } as Record<
    FeedbackStatus | "total",
    number
  >;
  for (const row of rows) {
    if (STATUSES.includes(row.status as FeedbackStatus)) {
      counts[row.status as FeedbackStatus] = row.n;
      counts.total += row.n;
    }
  }
  return counts;
}

export function updateFeedbackStatus(id: number, status: FeedbackStatus): void {
  if (!STATUSES.includes(status)) return;
  getDb()
    .prepare(`UPDATE voice_feedback SET status = ? WHERE id = ?`)
    .run(status, id);
}
