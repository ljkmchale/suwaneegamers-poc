import { describe, expect, it } from "vitest";
import {
  formatLearningReport,
  getAdminLearningReportForAgent,
  type LearningReport,
} from "@/lib/adminLearningReport";

const report: LearningReport = {
  learned: {
    total: 7,
    recentAt: "2026-08-19T10:52:00.000Z",
    mostAsked: [
      { question: "who is the DM for Mad Mage", timesAsked: 12 },
      { question: "where is the map", timesAsked: 5 },
    ],
  },
  gaps: {
    total: 3,
    top: [{ question: "how much does membership cost", timesAsked: 4 }],
  },
  tuning: {
    endpointing: "0.4-6s wait before replying",
    interruption: "interrupts after 3 words / 0.5s",
    llm: "temp 0.3, top-p 0.9",
  },
  corrections: { pending: 2, appliedRecently: 1 },
  usage: { days: 7, topPages: [{ path: "/campaigns", views: 210 }] },
};

describe("getAdminLearningReportForAgent gate", () => {
  it("returns an empty string for a non-admin", () => {
    expect(getAdminLearningReportForAgent(false)).toBe("");
  });
});

describe("formatLearningReport", () => {
  const block = formatLearningReport(report);

  it("labels itself admin-only and out-of-world", () => {
    expect(block).toContain("ADMIN-ONLY self-learning report");
    expect(block).toContain("not game lore");
  });

  it("reports learned answers, gaps, tuning, corrections, and usage", () => {
    expect(block).toContain("7 auto-learned");
    expect(block).toContain('"who is the DM for Mad Mage" (12x)');
    expect(block).toContain("3 unanswered question type(s)");
    expect(block).toContain('"how much does membership cost" (4x)');
    expect(block).toContain("0.4-6s wait before replying");
    expect(block).toContain("2 pending in the remediation queue, 1 applied");
    expect(block).toContain("/campaigns (210)");
  });
});
