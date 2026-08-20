import { describe, expect, it } from "vitest";
import {
  detectMisroutes,
  looksLikeCorrection,
  looksSelfReferential,
  type QuestionTurn,
} from "@/lib/assistantMisroutes";

function turn(sessionId: string, askedAt: string, question: string, category: string): QuestionTurn {
  return { sessionId, askedAt, question, category };
}

describe("misroute signal helpers", () => {
  it("recognizes self-referential questions", () => {
    expect(looksSelfReferential("what did you learn today")).toBe(true);
    expect(looksSelfReferential("how do you work")).toBe(true);
    expect(looksSelfReferential("what's on tonight")).toBe(false);
  });

  it("recognizes a correcting follow-up", () => {
    expect(looksLikeCorrection("no that's not what I asked")).toBe(true);
    expect(looksLikeCorrection("you misunderstood me")).toBe(true);
    expect(looksLikeCorrection("thanks, that's great")).toBe(false);
  });
});

describe("detectMisroutes", () => {
  it("flags a deterministic answer the member immediately corrects", () => {
    const found = detectMisroutes([
      turn("s1", "2026-08-20T10:00:00Z", "what did you learn today", "general_schedule"),
      turn("s1", "2026-08-20T10:00:30Z", "no, I meant what have you learned", "site_knowledge"),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].reason).toBe("correction");
    expect(found[0].category).toBe("general_schedule");
    expect(found[0].followup).toContain("what have you learned");
  });

  it("flags a self-referential question answered by a shortcut", () => {
    const found = detectMisroutes([
      turn("s2", "2026-08-20T11:00:00Z", "how do you work", "about_suwanee_gamers"),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].reason).toBe("self-referential");
  });

  it("does not flag a correct LLM answer or an unrelated follow-up", () => {
    const found = detectMisroutes([
      turn("s3", "2026-08-20T12:00:00Z", "what did you learn today", "site_knowledge"),
      turn("s3", "2026-08-20T12:00:20Z", "what's on tonight", "general_schedule"),
      turn("s3", "2026-08-20T12:01:00Z", "and Souls of Destiny?", "general_schedule"),
    ]);
    expect(found).toHaveLength(0);
  });

  it("ignores a correction that arrives too late to be about the last turn", () => {
    const found = detectMisroutes([
      turn("s4", "2026-08-20T13:00:00Z", "when does mad mage play", "general_schedule"),
      turn("s4", "2026-08-20T13:30:00Z", "no that's not what I asked", "site_knowledge"),
    ]);
    expect(found).toHaveLength(0);
  });
});
