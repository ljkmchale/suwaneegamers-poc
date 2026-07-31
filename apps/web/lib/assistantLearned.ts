// Myra's self-learning store. The nightly job (apps/web/scripts/learn-assistant.ts)
// takes questions members asked that Myra could not answer, sends each to the
// Chronicles RAG engine to find a grounded answer, and writes the results here.
// The LiveKit token route ships the learned answers to the agent as `faq`, and the
// agent matches them deterministically before falling back to the language model —
// so a question asked once is answered instantly and consistently the next time.
//
// NOT marked "server-only": also imported by the standalone learn script run
// outside Next via tsx (same pattern as lib/assistantTuningStore.ts).
import { getDb } from "@/lib/db";
import { readContent, writeContent } from "@/lib/contentFiles";

const LEARNED_FILE = "assistant-learned.json";

// How many learned answers to ship to the agent, and how long each may be. The
// FAQ rides in dispatch metadata every session, so it must stay compact; and a
// spoken answer should be a couple of sentences, matching the system prompt.
const MAX_FAQ_ENTRIES = 40;
const MAX_ANSWER_CHARS = 400;

export interface LearnedAnswer {
  /** The canonical asked question (most frequent phrasing). */
  question: string;
  /** Normalized key used for dedupe and agent-side matching. */
  normalized: string;
  answer: string;
  /** Source titles from the RAG engine, for admin display / provenance. */
  sources: string[];
  timesAsked: number;
  learnedAt: string;
}

export interface LearnedGap {
  question: string;
  normalized: string;
  timesAsked: number;
  /** When the loop last failed to find a grounded answer. */
  seenAt: string;
}

export interface LearnedStore {
  answers: LearnedAnswer[];
  gaps: LearnedGap[];
  /** Normalized questions an admin told Myra to forget — never re-learned or
   *  re-flagged as a gap. The off-switch for fully-automatic mode. */
  blocked: string[];
  updatedAt: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export const EMPTY_STORE: LearnedStore = { answers: [], gaps: [], blocked: [], updatedAt: "" };

/** Lowercase, strip punctuation, collapse whitespace — a stable matching key. */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Phrases the RAG engine uses when it cannot ground an answer. If any appears we
// treat the result as "not found" rather than teaching Myra a non-answer.
const REFUSAL_MARKERS = [
  "not documented",
  "i do not have",
  "i don't have",
  "i don't have a",
  "no player-facing source",
  "i should not invent",
  "not currently listed",
  "couldn't find",
  "could not find",
  "no record",
  "i'm not able to",
  "i am not able to",
];

// Conversational filler and diagnostics that reach the log as "questions" —
// often STT artifacts from a noisy room. Never worth learning.
const FILLER_PHRASES = new Set([
  "thank you",
  "thanks",
  "yes or no",
  "can you hear me",
  "can you hear me now",
  "are you hearing",
  "are you there",
  "hello",
  "hello there",
  "yeah",
  "okay",
  "ok",
  "testing",
  "test test",
  "never mind",
  "nothing",
]);

// Function words that carry no topic; a phrase made only of these isn't a question
// worth researching.
const NON_CONTENT_WORDS = new Set([
  "a", "an", "the", "is", "it", "this", "that", "so", "i", "m", "sorry", "yes", "no",
  "or", "and", "hello", "yeah", "ok", "okay", "thanks", "thank", "you", "please", "now",
  "um", "uh", "can", "hear", "me", "are", "hearing", "there", "do", "does", "to", "of",
  "for", "from", "here", "what", "s", "hi", "hey", "well", "just", "like", "know",
]);

/**
 * A question is learnable only if it's a real information request: at least three
 * words, not a known filler/diagnostic phrase, and containing at least one topic
 * word. This keeps "thank you" / "can you hear me?" / "yeah" out of the loop.
 */
export function isLearnableQuestion(question: string): boolean {
  const normalized = normalizeQuestion(question);
  if (!normalized) return false;
  if (FILLER_PHRASES.has(normalized)) return false;
  const words = normalized.split(" ");
  if (words.length < 3) return false;
  return words.some((word) => word.length > 2 && !NON_CONTENT_WORDS.has(word));
}

export function isRefusalAnswer(answer: string): boolean {
  const lower = answer.toLowerCase();
  return REFUSAL_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * A result is teachable only when it is grounded: the RAG engine cited at least
 * one source AND the answer is not a refusal. Ungrounded results become gaps, so
 * Myra never states an invented answer — the one safety line we hold even in
 * fully-automatic mode.
 */
export function isGroundedResult(result: { answer: string; sources: unknown[] }): boolean {
  const answer = (result.answer ?? "").trim();
  if (answer.length < 3) return false;
  if (isRefusalAnswer(answer)) return false;
  return Array.isArray(result.sources) && result.sources.length > 0;
}

/**
 * Strip markdown, links, and footnote citations so a RAG answer reads cleanly
 * aloud. Learned answers are spoken verbatim (they bypass the language model, so
 * the "don't read markdown/URLs aloud" system-prompt rule doesn't cover them).
 */
export function stripMarkdownForVoice(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2") // [[target|label]] -> label
    .replace(/\[\[([^\]]+)\]\]/g, "$1") // [[target]] -> target
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [label](url) -> label
    .replace(/https?:\/\/\S+/g, "") // bare URLs
    .replace(/\[\d+\]/g, "") // [1] footnote citations
    .replace(/[*`#~]+/g, "") // emphasis / code / heading / strikethrough markers
    .replace(/^\s*(?:[-+>]|\d+\.)\s+/gm, "") // leading list / blockquote markers
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1") // tidy space left before punctuation by removals
    .trim();
}

/** Clean and trim a RAG answer to a voice-friendly length, cutting on a sentence boundary. */
export function trimForVoice(answer: string, maxChars = MAX_ANSWER_CHARS): string {
  const clean = stripMarkdownForVoice(answer);
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars);
  const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (lastStop > maxChars * 0.5) return slice.slice(0, lastStop + 1);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : maxChars)}…`;
}

/** The compact FAQ shipped to the agent: most-asked first, capped and trimmed. */
export function selectFaqForAgent(
  store: LearnedStore,
  maxEntries = MAX_FAQ_ENTRIES,
  maxAnswerChars = MAX_ANSWER_CHARS,
): FaqEntry[] {
  return [...store.answers]
    .sort((a, b) => b.timesAsked - a.timesAsked)
    .slice(0, maxEntries)
    .map((entry) => ({ question: entry.question, answer: trimForVoice(entry.answer, maxAnswerChars) }));
}

export function readLearned(): LearnedStore {
  try {
    const raw = readContent<Partial<LearnedStore>>(LEARNED_FILE);
    return {
      answers: Array.isArray(raw?.answers) ? raw!.answers : [],
      gaps: Array.isArray(raw?.gaps) ? raw!.gaps : [],
      blocked: Array.isArray(raw?.blocked) ? raw!.blocked.map(String) : [],
      updatedAt: typeof raw?.updatedAt === "string" ? raw!.updatedAt : "",
    };
  } catch {
    return { answers: [], gaps: [], blocked: [], updatedAt: "" };
  }
}

/**
 * Remove a question from Myra's memory and block it from being re-learned. Pure
 * so it can be unit-tested; the server action reads, applies this, and writes.
 */
export function withQuestionForgotten(store: LearnedStore, normalized: string): LearnedStore {
  const key = normalizeQuestion(normalized);
  return {
    answers: store.answers.filter((a) => a.normalized !== key),
    gaps: store.gaps.filter((g) => g.normalized !== key),
    blocked: store.blocked.includes(key) ? store.blocked : [...store.blocked, key],
    updatedAt: store.updatedAt,
  };
}

export function writeLearned(store: LearnedStore): void {
  writeContent(LEARNED_FILE, store);
}

/** The FAQ the token route ships to the agent each session. */
export function getLearnedFaqForAgent(): FaqEntry[] {
  return selectFaqForAgent(readLearned());
}

export interface LearningCandidate {
  question: string;
  normalized: string;
  timesAsked: number;
  /** True if Myra actually failed the question (category 'unsupported'), vs. a
   *  'site_knowledge' turn the language model already handled. Only hard misses
   *  become gaps when the RAG engine can't ground an answer. */
  hardMiss: boolean;
}

/**
 * Questions worth learning: recent turns Myra handled with the language model or
 * could not answer at all, ranked by how often each was asked. Deterministic
 * schedule/recap/self-diagnosis answers are excluded — those already work.
 */
export function getLearningCandidates(
  days: number,
  limit = 40,
  blocked: ReadonlySet<string> = new Set(),
): LearningCandidate[] {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT question, COUNT(*) AS n,
              MAX(CASE WHEN category = 'unsupported' THEN 1 ELSE 0 END) AS hard_miss
         FROM voice_questions
        WHERE asked_at >= ?
          AND category IN ('unsupported', 'site_knowledge')
          AND question IS NOT NULL AND length(trim(question)) > 0
        GROUP BY lower(question)
        ORDER BY n DESC, MAX(asked_at) DESC
        LIMIT ?`,
    )
    .all(since, limit) as Array<{ question: string; n: number; hard_miss: number }>;

  // Collapse to normalized keys (the GROUP BY above is only lowercase).
  const byKey = new Map<string, LearningCandidate>();
  for (const row of rows) {
    if (!isLearnableQuestion(row.question)) continue;
    const normalized = normalizeQuestion(row.question);
    if (!normalized || blocked.has(normalized)) continue;
    const existing = byKey.get(normalized);
    if (existing) {
      existing.timesAsked += row.n;
      existing.hardMiss = existing.hardMiss || row.hard_miss === 1;
    } else {
      byKey.set(normalized, {
        question: row.question.trim(),
        normalized,
        timesAsked: row.n,
        hardMiss: row.hard_miss === 1,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => b.timesAsked - a.timesAsked);
}
