import { getDb } from "@/lib/db";
import { normalizeQuestion } from "@/lib/assistantLearned";

// Misroute detection — surfaces turns where Myra's deterministic router likely
// sent a question to the wrong handler, so the system flags them itself instead
// of a human catching them by ear. The nightly learning job feeds these into the
// remediation queue (category "routing-correction"), where they show up in
// /admin and in Myra's own self-learning report.
//
// A "misroute" is inferred from two high-precision signals, both grounded in
// what actually happened rather than a guess about intent:
//   1. Correction — a deterministic answer immediately followed, in the same
//      session, by the member correcting or re-asking. Category-agnostic, so it
//      catches misroutes the keyword matchers were never taught about.
//   2. Self-referential — a deterministic answer to a question that reads as being
//      about Myra herself (what she learned, what changed, how she works). Those
//      should fall through to the grounded model, never a calendar/FAQ shortcut.

/** A turn as stored in voice_questions, trimmed to what misroute detection needs. */
export interface QuestionTurn {
  sessionId: string;
  askedAt: string;
  question: string;
  category: string;
}

export interface MisrouteCandidate {
  question: string;
  normalized: string;
  /** The (suspected-wrong) category the deterministic router assigned. */
  category: string;
  reason: "correction" | "self-referential";
  /** The member's next turn, when the signal is a correction. */
  followup?: string;
  timesSeen: number;
}

// Categories that mean the language model (or a genuine failure) already handled
// the turn — never a deterministic shortcut, so never a misroute.
const NON_DETERMINISTIC = new Set(["site_knowledge", "unsupported", "unknown", ""]);

// The member's *next* turn signalling the previous answer was wrong.
const CORRECTION_RE =
  /\b(no,?\s+(i|that|you)|that'?s not (what|it|right)|not what i (asked|meant|said)|i (didn'?t|did not|never) (ask|say|mean)|you (misunderstood|got it wrong|misheard)|that'?s wrong|wrong answer|i meant|i was asking|i asked (you )?(about|for))\b/i;

// A question that is about Myra herself — mirrors is_self_report_question in the
// Python agent. Kept deliberately specific so it never false-flags ordinary asks.
const SELF_REFERENTIAL_RE =
  /\b(you learn(ed|t)?|you'?ve learned|have you learned|are you missing|can'?t you answer|tuned yourself|what'?s new|whats new|anything new|what changed|what have you changed|what did you change|any updates|anything happen|did anything change|how do you work|how you work|how (are|were) you built|what models|your systems|your architecture|describe yourself)\b/i;

const REASK_WINDOW_MS = 120_000;

export function looksSelfReferential(question: string): boolean {
  return SELF_REFERENTIAL_RE.test(question);
}

export function looksLikeCorrection(question: string): boolean {
  return CORRECTION_RE.test(question);
}

/**
 * Detect misrouted turns from a flat list of question rows. Pure and
 * side-effect-free so it can be unit-tested without a database.
 */
export function detectMisroutes(rows: QuestionTurn[]): MisrouteCandidate[] {
  // Group by session and order chronologically so "the next turn" is meaningful.
  const bySession = new Map<string, QuestionTurn[]>();
  for (const row of rows) {
    if (!row.question) continue;
    const list = bySession.get(row.sessionId) ?? [];
    list.push(row);
    bySession.set(row.sessionId, list);
  }

  // One candidate per distinct question. When a turn trips both signals, the
  // member correction is the stronger evidence, so it wins over self-referential.
  const byKey = new Map<string, MisrouteCandidate>();
  const flag = (
    question: string,
    category: string,
    reason: MisrouteCandidate["reason"],
    followup?: string,
  ) => {
    const normalized = normalizeQuestion(question);
    if (!normalized) return;
    const existing = byKey.get(normalized);
    if (existing) {
      existing.timesSeen += 1;
      if (reason === "correction") {
        existing.reason = "correction";
        if (followup) existing.followup = followup;
      }
      return;
    }
    byKey.set(normalized, { question: question.trim(), normalized, category, reason, followup, timesSeen: 1 });
  };

  for (const turns of bySession.values()) {
    turns.sort((a, b) => a.askedAt.localeCompare(b.askedAt));
    for (let i = 0; i < turns.length; i += 1) {
      const turn = turns[i];
      if (NON_DETERMINISTIC.has(turn.category)) continue;

      // Signal 1 (stronger): the member's very next turn, soon after, corrects it.
      const next = turns[i + 1];
      const gapMs = next ? Date.parse(next.askedAt) - Date.parse(turn.askedAt) : NaN;
      const corrected =
        next != null
        && !Number.isNaN(gapMs)
        && gapMs >= 0
        && gapMs <= REASK_WINDOW_MS
        && looksLikeCorrection(next.question);

      // Decide the turn's reason once so one turn counts once. Correction wins.
      if (corrected) {
        flag(turn.question, turn.category, "correction", next!.question);
      } else if (looksSelfReferential(turn.question)) {
        // Signal 2: the deterministic answer went to a question about Myra herself.
        flag(turn.question, turn.category, "self-referential");
      }
    }
  }

  return [...byKey.values()].sort((a, b) => b.timesSeen - a.timesSeen);
}

/** Pull recent turns and return the misroute candidates among them. */
export function getMisrouteCandidates(days: number, limit = 20): MisrouteCandidate[] {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT session_id AS sessionId, asked_at AS askedAt, question, category
         FROM voice_questions
        WHERE asked_at >= ? AND question IS NOT NULL AND length(trim(question)) > 0
        ORDER BY session_id, asked_at`,
    )
    .all(since) as QuestionTurn[];
  return detectMisroutes(rows).slice(0, limit);
}
