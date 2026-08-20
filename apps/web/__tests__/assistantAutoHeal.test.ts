import { describe, expect, it } from "vitest";
import { autoApplicableKind } from "@/lib/assistantAutoHeal";
import type { RemediationEntry } from "@/lib/assistantRemediation";

function entry(overrides: Partial<RemediationEntry>): RemediationEntry {
  return {
    id: "id",
    question: "q",
    normalized: "q",
    category: "learned-answer",
    proposedCorrection: "fix",
    evidence: [],
    source: "nightly-learning",
    timesSeen: 1,
    status: "pending",
    createdAt: "2026-08-20T00:00:00Z",
    ...overrides,
  };
}

describe("autoApplicableKind — the self-heal safety boundary", () => {
  it("applies a grounded learned answer", () => {
    expect(
      autoApplicableKind(
        entry({ category: "learned-answer", answerCandidate: "The abbey is north.", evidence: ["Gazetteer"] }),
      ),
    ).toBe("learned-answer");
  });

  it("refuses a learned answer with no grounding evidence", () => {
    expect(
      autoApplicableKind(entry({ category: "learned-answer", answerCandidate: "guess", evidence: [] })),
    ).toBeNull();
  });

  it("applies a mishearing fix with a derivable key and value", () => {
    expect(
      autoApplicableKind(entry({ category: "pronunciation-fix", question: "Hey Mara, tell me about the abbey" })),
    ).toBe("mishearing");
  });

  it("never auto-applies content or routing fixes (need a human or code)", () => {
    expect(autoApplicableKind(entry({ category: "brain-source-improvement" }))).toBeNull();
    expect(autoApplicableKind(entry({ category: "routing-correction" }))).toBeNull();
  });

  it("never touches an already-reviewed entry", () => {
    expect(
      autoApplicableKind(
        entry({ status: "approved", category: "learned-answer", answerCandidate: "x", evidence: ["s"] }),
      ),
    ).toBeNull();
  });
});
