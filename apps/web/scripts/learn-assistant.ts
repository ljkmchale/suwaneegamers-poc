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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getLearningCandidates,
  isGroundedResult,
  readLearned,
  trimForVoice,
  writeLearned,
  type LearnedGap,
} from "@/lib/assistantLearned";
import { enqueueRemediation } from "@/lib/assistantRemediation";

// The scheduler launches this script from the repository root, outside Next's
// normal boot path. Load apps/web/.env.local explicitly so the Brain vault,
// index, and data paths are available to the proposal generator.
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.readFileSync(path.join(webRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (!match || process.env[match[1]] !== undefined) continue;
  process.env[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
}

const WINDOW_DAYS = Number(process.env.ASSISTANT_LEARN_DAYS ?? 30);
const MAX_NEW_PER_RUN = Number(process.env.ASSISTANT_LEARN_MAX ?? 25);

function transcriptRemediation(question: string): {
  category: "pronunciation-fix" | "routing-correction";
  proposedCorrection: string;
} | null {
  const normalized = question.toLowerCase();
  const pronunciationSignals =
    /\b(pronounc|misheard|mispronounc|devira|diveria|divaria|de vera|hey mara|k-?9 watch)\b/;
  if (pronunciationSignals.test(normalized)) {
    return {
      category: "pronunciation-fix",
      proposedCorrection:
        "Review this transcript and add the intended name or phrase to Myra's speech alias and pronunciation map.",
    };
  }
  const memberCorrectionSignals =
    /\b(i don'?t play|i do not play|i only play|not part of|that'?s not right|that is not right)\b/;
  if (memberCorrectionSignals.test(normalized)) {
    return {
      category: "routing-correction",
      proposedCorrection:
        "Review this member correction and update the relevant profile or campaign routing rule before teaching an answer.",
    };
  }
  return null;
}

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

  let proposed = 0;
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

    const transcriptIssue = transcriptRemediation(candidate.question);
    if (transcriptIssue) {
      enqueueRemediation({
        question: candidate.question,
        ...transcriptIssue,
        evidence: ["Voice transcript"],
        source: "voice-analytics",
        timesSeen: candidate.timesAsked,
      });
      console.log(`[${stamp}] learn: QUEUED ${transcriptIssue.category} "${candidate.question}"`);
      continue;
    }

    let result: { answer: string; sources: Array<{ title?: string }> };
    try {
      result = await answerQuestion(candidate.question, { visibility: "players" });
    } catch (error) {
      console.warn(`[${stamp}] learn: RAG failed for "${candidate.question}": ${String(error)}`);
      enqueueRemediation({
        question: candidate.question,
        category: "routing-correction",
        proposedCorrection:
          "Retry the Brain query and inspect the retrieval service or rate limit before changing content.",
        evidence: [String(error).slice(0, 300)],
        source: "nightly-learning",
        timesSeen: candidate.timesAsked,
      });
      continue;
    }

    if (isGroundedResult(result)) {
      const evidence = result.sources
        .map((source) => String(source.title ?? ""))
        .filter(Boolean)
        .slice(0, 5);
      enqueueRemediation({
        question: candidate.question,
        category: "learned-answer",
        proposedCorrection: "Approve this grounded answer so Myra can answer it instantly next time.",
        answerCandidate: trimForVoice(result.answer),
        evidence,
        source: "nightly-learning",
        timesSeen: candidate.timesAsked,
      });
      proposed += 1;
      console.log(`[${stamp}] learn: PROPOSED "${candidate.question}" (${evidence.length} source(s))`);
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
      enqueueRemediation({
        question: candidate.question,
        category: "brain-source-improvement",
        proposedCorrection: "Add or sync a player-safe source that answers this question, then rerun learning.",
        evidence: [],
        source: "nightly-learning",
        timesSeen: candidate.timesAsked,
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
    `[${stamp}] learn: done — ${proposed} proposal(s) queued, ${gaps.length} unanswered gap(s), ` +
      `${knownAnswers.size} total answers.`,
  );
}

main().catch((error) => {
  console.error("learn-assistant failed:", error);
  process.exitCode = 1;
});
