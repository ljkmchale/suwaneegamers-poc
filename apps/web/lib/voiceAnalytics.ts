import "server-only";

import { getDb } from "@/lib/db";
import { pruneExpired } from "@/lib/retention";
import { classifyVoicePurpose } from "@/lib/usagePurpose";

function clean(value: unknown, length: number): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, length)
    : "";
}

export function startVoiceSession(input: {
  sessionId: string;
  roomName: string;
  memberId: string;
  memberName?: string | null;
  memberEmail?: string | null;
}) {
  getDb().prepare(`
    INSERT INTO voice_sessions
      (session_id, room_name, member_id, member_name, member_email, started_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.sessionId,
    input.roomName,
    input.memberId,
    clean(input.memberName, 120) || null,
    clean(input.memberEmail, 200) || null,
    new Date().toISOString(),
  );
}

export function endVoiceSession(sessionId: string) {
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE voice_sessions
    SET ended_at = ?,
        duration_seconds = MAX(0, CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER)),
        status = 'completed'
    WHERE session_id = ? AND ended_at IS NULL
  `).run(now, now, clean(sessionId, 100));
}

export function recordVoiceQuestion(input: {
  sessionId: string;
  question: unknown;
  answer?: unknown;
  category: unknown;
  responseMode: unknown;
  model?: unknown;
  responseMs?: unknown;
  success?: unknown;
  errorMessage?: unknown;
}) {
  const sessionId = clean(input.sessionId, 100);
  const question = clean(input.question, 800);
  if (!sessionId || !question) throw new Error("Missing voice session or question");
  const success = input.success !== false;
  const category = clean(input.category, 50) || "unknown";
  const askedAt = new Date().toISOString();
  getDb().transaction(() => {
    const inserted = getDb().prepare(`
      INSERT INTO voice_questions
        (session_id, asked_at, question, answer, category, response_mode, model, response_ms, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      askedAt,
      question,
      clean(input.answer, 1200) || null,
      category,
      clean(input.responseMode, 50) || "unknown",
      clean(input.model, 40) || null,
      Math.min(600_000, Math.max(0, Math.round(Number(input.responseMs) || 0))),
      success ? 1 : 0,
      clean(input.errorMessage, 500) || null,
    );
    const signal = classifyVoicePurpose(category);
    getDb().prepare(`
      INSERT OR IGNORE INTO analytics_purpose_signals
        (session_id, source, source_id, purpose, signal_type, confidence, path, created_at)
      VALUES (?, 'voice_question', ?, ?, ?, ?, '/myra', ?)
    `).run(
      sessionId,
      Number(inserted.lastInsertRowid),
      signal.purpose,
      signal.signalType,
      signal.confidence,
      askedAt,
    );
    getDb().prepare(`
      UPDATE voice_sessions
      SET question_count = question_count + 1,
          error_count = error_count + ?,
          status = 'active'
      WHERE session_id = ?
    `).run(success ? 0 : 1, sessionId);
  })();
  pruneExpired([{ table: "analytics_purpose_signals", column: "created_at", days: 90 }]);
}

export function getVoiceAnalytics(days: number) {
  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const db = getDb();

  const summary = db.prepare(`
    SELECT COUNT(*) AS sessions,
      COUNT(DISTINCT member_id) AS users,
      COALESCE(SUM(question_count), 0) AS questions,
      COALESCE(AVG(NULLIF(duration_seconds, 0)), 0) AS average_duration,
      COALESCE(SUM(error_count), 0) AS errors
    FROM voice_sessions WHERE started_at >= ?
  `).get(sinceIso) as {
    sessions: number; users: number; questions: number; average_duration: number; errors: number;
  };
  const timing = db.prepare(`
    SELECT COALESCE(AVG(response_ms), 0) AS average_ms,
      COALESCE(MAX(response_ms), 0) AS slowest_ms,
      SUM(CASE WHEN response_ms >= 5000 THEN 1 ELSE 0 END) AS slow_responses
    FROM voice_questions WHERE asked_at >= ?
  `).get(sinceIso) as { average_ms: number; slowest_ms: number; slow_responses: number };
  const categories = db.prepare(`
    SELECT category AS label, COUNT(*) AS value
    FROM voice_questions WHERE asked_at >= ?
    GROUP BY category ORDER BY value DESC
  `).all(sinceIso) as Array<{ label: string; value: number }>;
  const recentQuestions = db.prepare(`
    SELECT q.id, q.asked_at, q.question, q.answer, q.category, q.response_mode, q.model,
      q.response_ms, q.success, q.error_message, s.member_name, s.member_email
    FROM voice_questions q JOIN voice_sessions s ON s.session_id = q.session_id
    WHERE q.asked_at >= ? ORDER BY q.asked_at DESC LIMIT 50
  `).all(sinceIso) as Array<{
    id: number; asked_at: string; question: string; answer: string | null; category: string;
    response_mode: string; model: string | null; response_ms: number | null; success: number; error_message: string | null;
    member_name: string | null; member_email: string | null;
  }>;
  const unsupported = db.prepare(`
    SELECT question AS label, COUNT(*) AS value
    FROM voice_questions
    WHERE asked_at >= ? AND category = 'unsupported'
    GROUP BY lower(question) ORDER BY value DESC, asked_at DESC LIMIT 15
  `).all(sinceIso) as Array<{ label: string; value: number }>;

  return {
    summary: {
      sessions: summary.sessions,
      users: summary.users,
      questions: summary.questions,
      averageDurationSeconds: Math.round(summary.average_duration),
      errors: summary.errors,
      averageResponseMs: Math.round(timing.average_ms),
      slowestResponseMs: Math.round(timing.slowest_ms),
      slowResponses: timing.slow_responses,
    },
    categories,
    unsupported,
    recentQuestions: recentQuestions.map((row) => ({
      id: row.id,
      askedAt: row.asked_at,
      question: row.question,
      answer: row.answer,
      category: row.category,
      responseMode: row.response_mode,
      model: row.model,
      responseMs: row.response_ms ?? 0,
      success: row.success === 1,
      errorMessage: row.error_message,
      member: row.member_name ?? row.member_email ?? "Signed-in member",
    })),
  };
}
