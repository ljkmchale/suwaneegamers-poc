// Nightly self-learning job for Myra, the home-page voice assistant.
//
// Reads the questions members recently asked that Myra answered with the language
// model or could not answer at all, sends each to the Chronicles RAG engine to
// find a grounded answer, and writes content/assistant-learned.json. The token
// route ships the learned answers to the agent, which matches them before falling
// back to the model — so the next time the same question is asked, Myra just knows.
//
// Grounding is the one hard rule: an answer is only learned when the RAG engine
// cites a source and does not refuse. Everything else is logged as a "gap" for
// review — Myra never invents an answer.
//
// Run manually:  cd apps/web && npx tsx scripts/learn-assistant.ts
// Scheduler job id: "assistant-learn".
import { answerQuestion } from "@/lib/brain/query";
import {
  getLearningCandidates,
  isGroundedResult,
  readLearned,
  trimForVoice,
  writeLearned,
  type LearnedAnswer,
  type LearnedGap,
} from "@/lib/assistantLearned";

const WINDOW_DAYS = Number(process.env.ASSISTANT_LEARN_DAYS ?? 30);
const MAX_NEW_PER_RUN = Number(process.env.ASSISTANT_LEARN_MAX ?? 25);

async function main(): Promise<void> {
  const stamp = new Date().toISOString();
  const store = readLearned();
  // Learned answers are cumulative — once found, they persist. Gaps are rebuilt
  // fresh each run from the current window, so stale/noise entries self-clear.
  const knownAnswers = new Map(store.answers.map((a) => [a.normalized, a]));
  const gaps: LearnedGap[] = [];
  const blocked = new Set(store.blocked);

  const candidates = getLearningCandidates(WINDOW_DAYS, undefined, blocked);
  console.log(`[${stamp}] learn: ${candidates.length} candidate question(s) in last ${WINDOW_DAYS}d`);

  let learned = 0;
  let attempts = 0;

  for (const candidate of candidates) {
    // Keep the frequency counter fresh even for things already known.
    const existingAnswer = knownAnswers.get(candidate.normalized);
    if (existingAnswer) {
      existingAnswer.timesAsked = candidate.timesAsked;
      continue;
    }
    if (attempts >= MAX_NEW_PER_RUN) continue;
    attempts += 1;

    let result: { answer: string; sources: Array<{ title?: string }> };
    try {
      result = await answerQuestion(candidate.question, { visibility: "players" });
    } catch (error) {
      console.warn(`[${stamp}] learn: RAG failed for "${candidate.question}": ${String(error)}`);
      continue;
    }

    if (isGroundedResult(result)) {
      const answer: LearnedAnswer = {
        question: candidate.question,
        normalized: candidate.normalized,
        answer: trimForVoice(result.answer),
        sources: result.sources.map((s) => String(s.title ?? "")).filter(Boolean).slice(0, 5),
        timesAsked: candidate.timesAsked,
        learnedAt: stamp,
      };
      knownAnswers.set(candidate.normalized, answer);
      learned += 1;
      console.log(`[${stamp}] learn: LEARNED "${candidate.question}" (${answer.sources.length} source(s))`);
    } else if (candidate.hardMiss) {
      // Only a genuine miss (Myra said she couldn't answer) that the RAG engine
      // also can't ground becomes a gap for review. Questions the language model
      // already handles are left alone rather than flagged as noise.
      gaps.push({
        question: candidate.question,
        normalized: candidate.normalized,
        timesAsked: candidate.timesAsked,
        seenAt: stamp,
      });
    }
  }

  writeLearned({
    answers: [...knownAnswers.values()].sort((a, b) => b.timesAsked - a.timesAsked),
    gaps: gaps.sort((a, b) => b.timesAsked - a.timesAsked),
    blocked: [...blocked],
    updatedAt: stamp,
  });

  console.log(
    `[${stamp}] learn: done — ${learned} newly learned, ${gaps.length} unanswered gap(s), ` +
      `${knownAnswers.size} total answers.`,
  );
}

main().catch((error) => {
  console.error("learn-assistant failed:", error);
  process.exitCode = 1;
});
