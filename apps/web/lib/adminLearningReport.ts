import { readLearned } from "@/lib/assistantLearned";
import { readAssistantTuning } from "@/lib/assistantTuningStore";
import { readRemediations, readRemediationAudit } from "@/lib/assistantRemediation";
import { getAnalyticsDashboardData } from "@/lib/analytics";
import { getRecentHeals, healsSince } from "@/lib/assistantHealLog";

// Myra's SELF-LEARNING REPORT — an admin-only window into what she has taught
// herself and the patterns she tracks: auto-learned answers, the knowledge gaps
// she keeps hitting, how she has been auto-tuned, the correction queue, and what
// visitors actually engage with.
//
// Like the admin operations snapshot, this is gated in the LiveKit token route
// (verified admin only) and getAdminLearningReportForAgent() returns "" for
// everyone else, so the data never enters dispatch metadata for a non-admin.
// This is distinct from the ops snapshot (current back-office status) — it is
// Myra reflecting on her own learning.

const ANALYTICS_WINDOW_DAYS = 7;
const TOP_N = 3;

export interface LearningReport {
  learned: { total: number; recentAt: string | null; mostAsked: Array<{ question: string; timesAsked: number }> };
  gaps: { total: number; top: Array<{ question: string; timesAsked: number }> };
  tuning: { endpointing: string; interruption: string; llm: string };
  corrections: { pending: number; appliedRecently: number };
  usage: { days: number; topPages: Array<{ path: string; views: number }> };
  selfHealed: { last7Days: number; recent: Array<{ kind: string; question: string }> };
}

export function gatherLearningReport(): LearningReport {
  let learned = { total: 0, recentAt: null as string | null, mostAsked: [] as Array<{ question: string; timesAsked: number }> };
  let gaps = { total: 0, top: [] as Array<{ question: string; timesAsked: number }> };
  try {
    const store = readLearned();
    const answers = [...store.answers].sort((a, b) => b.timesAsked - a.timesAsked);
    const recentAt = [...store.answers]
      .map((answer) => answer.learnedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
    learned = {
      total: store.answers.length,
      recentAt,
      mostAsked: answers.slice(0, TOP_N).map((a) => ({ question: a.question, timesAsked: a.timesAsked })),
    };
    const rankedGaps = [...store.gaps].sort((a, b) => b.timesAsked - a.timesAsked);
    gaps = {
      total: store.gaps.length,
      top: rankedGaps.slice(0, TOP_N).map((g) => ({ question: g.question, timesAsked: g.timesAsked })),
    };
  } catch { /* leave empty */ }

  let tuning = { endpointing: "defaults", interruption: "defaults", llm: "defaults" };
  try {
    const t = readAssistantTuning();
    tuning = {
      endpointing: `${t.minEndpointingDelay}-${t.maxEndpointingDelay}s wait before replying`,
      interruption: `interrupts after ${t.minInterruptionWords} words / ${t.minInterruptionDuration}s`,
      llm: `temp ${t.ollamaTemperature}, top-p ${t.ollamaTopP}`,
    };
  } catch { /* leave defaults label */ }

  let corrections = { pending: 0, appliedRecently: 0 };
  try {
    const store = readRemediations();
    const audit = readRemediationAudit();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    corrections = {
      pending: store.entries.filter((entry) => entry.status === "pending").length,
      appliedRecently: audit.filter(
        (row) => row.action === "applied" && Date.parse(row.createdAt) >= weekAgo,
      ).length,
    };
  } catch { /* leave zeroes */ }

  let usage = { days: ANALYTICS_WINDOW_DAYS, topPages: [] as Array<{ path: string; views: number }> };
  try {
    const data = getAnalyticsDashboardData(ANALYTICS_WINDOW_DAYS);
    usage = {
      days: data.days,
      topPages: data.topPages.slice(0, TOP_N).map((page) => ({ path: page.path, views: page.pageViews })),
    };
  } catch { /* leave empty */ }

  let selfHealed = { last7Days: 0, recent: [] as Array<{ kind: string; question: string }> };
  try {
    selfHealed = {
      last7Days: healsSince(7),
      recent: getRecentHeals(5).map((heal) => ({ kind: heal.kind, question: heal.question })),
    };
  } catch { /* leave empty */ }

  return { learned, gaps, tuning, corrections, usage, selfHealed };
}

/** Format the report as a compact, admin-only, out-of-world block. Pure over its
 *  input so it can be unit-tested without a database. */
export function formatLearningReport(report: LearningReport): string {
  const lines: string[] = [
    "ADMIN-ONLY self-learning report. Present ONLY because a verified admin is",
    "signed in. This is you reflecting on what you have taught yourself and the",
    "patterns you track — real-world facts about your own operation, not game lore.",
    "Report it plainly when the admin asks what you've learned, what you're missing,",
    "how you've tuned yourself, or what people ask. Keep numbers exact.",
    "",
    `- Learned answers: ${report.learned.total} auto-learned${
      report.learned.recentAt ? `, most recent ${report.learned.recentAt.slice(0, 10)}` : ""
    }.`,
  ];
  if (report.learned.mostAsked.length > 0) {
    lines.push(
      `  Most-asked I now answer: ${report.learned.mostAsked
        .map((a) => `"${a.question}" (${a.timesAsked}x)`)
        .join("; ")}.`,
    );
  }

  lines.push(`- Knowledge gaps I keep hitting: ${report.gaps.total} unanswered question type(s).`);
  if (report.gaps.top.length > 0) {
    lines.push(
      `  Top gaps: ${report.gaps.top.map((g) => `"${g.question}" (${g.timesAsked}x)`).join("; ")}.`,
    );
  }

  lines.push(
    `- Self-tuning (auto-tuned nightly): ${report.tuning.endpointing}; ${report.tuning.interruption}; ${report.tuning.llm}.`,
    `- Corrections: ${report.corrections.pending} pending in the remediation queue, ${report.corrections.appliedRecently} applied in the last 7 days.`,
  );

  if (report.usage.topPages.length > 0) {
    lines.push(
      `- Usage (last ${report.usage.days} days) top pages: ${report.usage.topPages
        .map((page) => `${page.path} (${page.views})`)
        .join(", ")}.`,
    );
  }

  lines.push(
    `- Self-healed (last 7 days): ${report.selfHealed.last7Days} fix(es) I applied on my own${
      report.selfHealed.recent.length > 0
        ? `; most recent: ${report.selfHealed.recent.map((h) => `${h.kind} for "${h.question}"`).join("; ")}`
        : ""
    }.`,
  );

  return lines.join("\n");
}

/**
 * The self-learning report block for dispatch metadata. Returns "" unless the
 * caller proved a verified admin is signed in (in the token route), so it never
 * enters metadata for anyone else.
 */
export function getAdminLearningReportForAgent(isVerifiedAdmin: boolean): string {
  if (!isVerifiedAdmin) return "";
  return formatLearningReport(gatherLearningReport());
}
