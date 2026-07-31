import { describe, expect, it } from "vitest";
import {
  proposeRemediationApplication,
  remediationId,
  type RemediationEntry,
} from "@/lib/assistantRemediation";

function entry(overrides: Partial<RemediationEntry>): RemediationEntry {
  return {
    id: "rem-test",
    question: "Hey Mara, what do you know about the gods?",
    normalized: "hey mara what do you know about the gods",
    category: "pronunciation-fix",
    proposedCorrection: "Correct the assistant name.",
    evidence: ["Voice transcript"],
    source: "voice-analytics",
    timesSeen: 1,
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("remediation proposals", () => {
  it("creates stable ids per normalized question and category", () => {
    expect(remediationId("Hey, Mara!", "pronunciation-fix")).toBe(
      remediationId("hey mara", "pronunciation-fix"),
    );
    expect(remediationId("hey mara", "routing-correction")).not.toBe(
      remediationId("hey mara", "pronunciation-fix"),
    );
  });

  it("turns known speech errors into an editable mishearing correction", () => {
    expect(proposeRemediationApplication(entry({}))).toMatchObject({
      kind: "mishearing",
      key: "Mara",
      value: "Myra",
    });
  });

  it("extracts an explicit heard and intended phrase", () => {
    const proposal = proposeRemediationApplication(
      entry({
        question: "It's not K-9 watch, it's Night Watch.",
      }),
    );
    expect(proposal).toMatchObject({
      kind: "mishearing",
      key: "K-9 watch",
      value: "Night Watch",
    });
  });

  it("creates tracked tasks for ambiguous routing and brain-source work", () => {
    expect(
      proposeRemediationApplication(
        entry({ category: "routing-correction", question: "I am not in that campaign." }),
      ).kind,
    ).toBe("routing-task");
    expect(
      proposeRemediationApplication(
        entry({ category: "brain-source-improvement", question: "Who founded Riverwatch?" }),
      ).kind,
    ).toBe("brain-task");
  });
});
