import { describe, expect, it } from "vitest";
import { classifySitePurpose, classifyVoicePurpose } from "@/lib/usagePurpose";

describe("usage purpose classification", () => {
  it("classifies passive page and engagement signals", () => {
    expect(classifySitePurpose({ eventType: "page_view", path: "/calendar" }))
      .toEqual({ purpose: "schedule_planning", signalType: "page", confidence: 60 });
    expect(classifySitePurpose({ eventType: "page_engagement", path: "/advents_of_harmony", durationSeconds: 30 }))
      .toEqual({ purpose: "lore_research", signalType: "engagement", confidence: 75 });
  });

  it("uses explicit search and media behavior as stronger evidence", () => {
    expect(classifySitePurpose({ eventType: "search_query", path: "/", contentLabel: "next game" })?.purpose)
      .toBe("schedule_planning");
    expect(classifySitePurpose({ eventType: "media_play", path: "/calendar", contentType: "audio" }))
      .toEqual({ purpose: "session_catchup", signalType: "media", confidence: 95 });
  });

  it("ignores operational noise and short engagement", () => {
    expect(classifySitePurpose({ eventType: "heartbeat", path: "/campaigns" })).toBeNull();
    expect(classifySitePurpose({ eventType: "page_engagement", path: "/campaigns", durationSeconds: 5 })).toBeNull();
  });

  it("maps Myra question categories into the same purpose vocabulary", () => {
    expect(classifyVoicePurpose("personal_schedule").purpose).toBe("schedule_planning");
    expect(classifyVoicePurpose("recap_clarify").purpose).toBe("session_catchup");
    expect(classifyVoicePurpose("self_diagnosis").purpose).toBe("myra_assistance");
  });
});
