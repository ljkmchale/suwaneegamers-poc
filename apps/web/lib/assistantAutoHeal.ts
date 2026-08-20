import {
  proposeRemediationApplication,
  type RemediationEntry,
} from "@/lib/assistantRemediation";

// Decides which pending remediations Myra may apply to HERSELF, unattended —
// the safety boundary for self-healing. Only reversible, low-risk fixes qualify,
// and only ones whose correction is fully determined by data:
//
//   - learned-answer  : a grounded RAG answer (cited sources, non-refusal). The
//                       grounding rule is the safety property — Myra never invents.
//   - mishearing/pron : a concrete transcript/pronunciation fix with a derivable
//                       key AND value.
//
// Deliberately NOT auto-applied (they need a human or code, so they stay flagged):
//   - brain-source-improvement : requires adding real content Myra cannot invent.
//   - routing-correction       : requires a code/router change, not a data edit.
//
// This module is pure (no fs, no db) so the boundary is unit-testable. The nightly
// job verifies grounding again before applying a learned answer, and every apply
// is written to the audit log and can be undone.

export type AutoHealKind = "learned-answer" | "mishearing" | "pronunciation";

/**
 * The kind of self-apply this entry qualifies for, or null when it must stay a
 * human/coded review. Pure over the entry.
 */
export function autoApplicableKind(entry: RemediationEntry): AutoHealKind | null {
  if (entry.status !== "pending") return null;

  const proposal = proposeRemediationApplication(entry);

  if (proposal.kind === "learned-answer") {
    const hasAnswer = (entry.answerCandidate ?? "").trim().length > 0;
    const grounded = entry.evidence.length > 0;
    return hasAnswer && grounded ? "learned-answer" : null;
  }

  if (proposal.kind === "mishearing" || proposal.kind === "pronunciation") {
    return proposal.key.trim().length > 0 && proposal.value.trim().length > 0
      ? proposal.kind
      : null;
  }

  // brain-task / routing-task — not safely self-applicable.
  return null;
}

export function isAutoApplicable(entry: RemediationEntry): boolean {
  return autoApplicableKind(entry) !== null;
}
