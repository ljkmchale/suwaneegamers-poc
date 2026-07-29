import { describe, expect, it } from "vitest";
import {
  isGroundedResult,
  isLearnableQuestion,
  isRefusalAnswer,
  normalizeQuestion,
  selectFaqForAgent,
  trimForVoice,
  withQuestionForgotten,
  type LearnedStore,
} from "@/lib/assistantLearned";

describe("normalizeQuestion", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeQuestion("  Who RUNS  the Mad Mage?? ")).toBe("who runs the mad mage");
  });

  it("ignores casing and punctuation, splitting on apostrophes", () => {
    expect(normalizeQuestion("Who are the DMs?")).toBe(normalizeQuestion("who are the dms"));
    // Apostrophes become spaces (no contraction expansion), consistently on both sides.
    expect(normalizeQuestion("Where's the lore!")).toBe("where s the lore");
  });
});

describe("isLearnableQuestion", () => {
  it("rejects filler, greetings, diagnostics, and too-short utterances", () => {
    for (const junk of [
      "Thank you.",
      "Yeah.",
      "Hello?",
      "Can you hear me?",
      "Are you hearing?",
      "Yes or no?",
      "ok",
    ]) {
      expect(isLearnableQuestion(junk), junk).toBe(false);
    }
  });

  it("accepts real information requests", () => {
    for (const real of [
      "Who runs the Mad Mage campaign?",
      "What campaigns are there?",
      "When does Bloody Endeavor play?",
      "Where is the lore kept?",
    ]) {
      expect(isLearnableQuestion(real), real).toBe(true);
    }
  });
});

describe("isRefusalAnswer / isGroundedResult", () => {
  it("flags RAG refusal phrasing", () => {
    expect(isRefusalAnswer("Vecna is not documented in this campaign.")).toBe(true);
    expect(isRefusalAnswer("I don't have a player-facing source for that.")).toBe(true);
    expect(isRefusalAnswer("The party defeated the lich at Emberstran.")).toBe(false);
  });

  it("only treats sourced, non-refusal answers as grounded", () => {
    expect(
      isGroundedResult({ answer: "The party defeated the lich.", sources: [{ title: "Session 12" }] }),
    ).toBe(true);
    // Refusal, even with a source, is not grounded.
    expect(
      isGroundedResult({ answer: "That is not documented.", sources: [{ title: "x" }] }),
    ).toBe(false);
    // A real-sounding answer with no source is not grounded (never fabricate).
    expect(isGroundedResult({ answer: "The party won.", sources: [] })).toBe(false);
    // Empty answer.
    expect(isGroundedResult({ answer: "  ", sources: [{ title: "x" }] })).toBe(false);
  });
});

describe("trimForVoice", () => {
  it("keeps short answers intact", () => {
    expect(trimForVoice("A short answer.")).toBe("A short answer.");
  });

  it("strips markdown, links, and citations so it reads aloud cleanly", () => {
    expect(trimForVoice("The **party** fought a lich [1].")).toBe("The party fought a lich.");
    expect(trimForVoice("See [Session 12](https://kb.example.com/s12) for details.")).toBe(
      "See Session 12 for details.",
    );
    expect(trimForVoice("- First point\n- Second point")).toBe("First point Second point");
  });

  it("cuts long answers on a sentence boundary", () => {
    const long = "First sentence is here. " + "x".repeat(800);
    const out = trimForVoice(long, 60);
    expect(out.length).toBeLessThanOrEqual(61);
    expect(out).toContain("First sentence is here.");
  });
});

describe("withQuestionForgotten", () => {
  const store: LearnedStore = {
    answers: [
      { question: "Who runs Mad Mage?", normalized: "who runs mad mage", answer: "a", sources: ["s"], timesAsked: 3, learnedAt: "" },
    ],
    gaps: [
      { question: "What is X?", normalized: "what is x", timesAsked: 2, seenAt: "" },
    ],
    blocked: [],
    updatedAt: "2026-01-01",
  };

  it("removes a learned answer and blocks it from re-learning", () => {
    const next = withQuestionForgotten(store, "who runs mad mage");
    expect(next.answers).toHaveLength(0);
    expect(next.blocked).toContain("who runs mad mage");
  });

  it("removes a gap and blocks it, and accepts raw (un-normalized) input", () => {
    const next = withQuestionForgotten(store, "What is X?");
    expect(next.gaps).toHaveLength(0);
    expect(next.blocked).toContain("what is x");
  });

  it("does not duplicate an already-blocked key", () => {
    const seeded: LearnedStore = { ...store, blocked: ["who runs mad mage"] };
    const next = withQuestionForgotten(seeded, "who runs mad mage");
    expect(next.blocked.filter((k) => k === "who runs mad mage")).toHaveLength(1);
  });
});

describe("selectFaqForAgent", () => {
  const store: LearnedStore = {
    answers: [
      { question: "q1", normalized: "q1", answer: "a1", sources: ["s"], timesAsked: 2, learnedAt: "" },
      { question: "q2", normalized: "q2", answer: "a2", sources: ["s"], timesAsked: 9, learnedAt: "" },
      { question: "q3", normalized: "q3", answer: "a3", sources: ["s"], timesAsked: 5, learnedAt: "" },
    ],
    gaps: [],
    blocked: [],
    updatedAt: "",
  };

  it("returns most-asked first and caps the count", () => {
    const faq = selectFaqForAgent(store, 2);
    expect(faq.map((f) => f.question)).toEqual(["q2", "q3"]);
  });

  it("trims answers to the given length", () => {
    const big: LearnedStore = {
      answers: [
        {
          question: "q",
          normalized: "q",
          answer: "Sentence one. " + "y".repeat(500),
          sources: ["s"],
          timesAsked: 1,
          learnedAt: "",
        },
      ],
      gaps: [],
      blocked: [],
      updatedAt: "",
    };
    const [entry] = selectFaqForAgent(big, 10, 40);
    expect(entry.answer.length).toBeLessThanOrEqual(41);
  });
});
