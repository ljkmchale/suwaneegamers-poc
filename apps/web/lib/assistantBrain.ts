import fs from "fs";
import { getActiveCampaigns } from "@/lib/campaigns";
import { contentPath, readContent } from "@/lib/contentFiles";

// Myra's knowledge base ("the brain"). It is a curated
// Markdown file (content/assistant-brain.md) maintained by
// scripts/build-assistant-brain.mjs. The LiveKit token route ships its contents
// to the agent in dispatch metadata so Myra can answer questions about
// the group and site — not just the schedule.
//
// This is intentionally a plain-file read rather than the DB-first content
// helpers: the brain is a generated artifact, not CMS-edited content, and it is
// Markdown rather than JSON.
export function getAssistantBrain(): string {
  try {
    return fs.readFileSync(contentPath("assistant-brain.md"), "utf-8").trim();
  } catch {
    // Missing brain must never break voice-session issuance; the agent falls
    // back to schedule-only behavior when knowledge is empty.
    return "";
  }
}

interface AboutBlock {
  type?: string;
  props?: {
    content?: string;
  };
}

// Keep Myra's description of the group aligned with the editable Our Story page.
// readContent() is intentionally used here because this page is DB-first at runtime.
export function getAssistantAbout(): string {
  try {
    return readContent<AboutBlock[]>("page-layouts/ourstory.json")
      .filter((block) => block.type === "text")
      .map((block) => prepareForVoice(String(block.props?.content ?? "")))
      .filter(Boolean)
      .join(" ");
  } catch {
    return "";
  }
}

export function getAssistantPronunciations(): Record<string, string> {
  try {
    const value = JSON.parse(
      fs.readFileSync(contentPath("assistant-pronunciations.json"), "utf-8"),
    ) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter(([word, pronunciation]) =>
          word.trim().length > 0
          && typeof pronunciation === "string"
          && pronunciation.trim().length > 0)
        .map(([word, pronunciation]) => [word.trim(), pronunciation.trim()]),
    );
  } catch {
    return {};
  }
}

// The inverse of the pronunciation map. Pronunciations fix what Myra *says*;
// these fix what she *hears*. Whisper has never seen the group's invented proper
// nouns, so "Emberstran" comes back as "Imberstran" and the answer that follows
// is wrong — which costs a whole correction turn. Keys are what the transcript
// contains, values are the canonical spelling.
export function getAssistantMishearings(): Record<string, string> {
  try {
    const value = JSON.parse(
      fs.readFileSync(contentPath("assistant-mishearings.json"), "utf-8"),
    ) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter(([heard, canonical]) =>
          heard.trim().length > 0
          && typeof canonical === "string"
          && canonical.trim().length > 0)
        .map(([heard, canonical]) => [heard.trim(), canonical.trim()]),
    );
  } catch {
    return {};
  }
}

export interface AssistantRecap {
  name: string;
  aliases: string[];
  title: string;
  summary: string;
}

// Normalize whitespace for speech without shortening the source. Visitors who
// ask what happened last time expect the complete latest-session recap.
function prepareForVoice(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// The most recent session summary per campaign, for "what happened last time in X".
// IMPORTANT: read from getActiveCampaigns() — the same relational-DB source the live
// site uses (populated by the session-notes sync) — NOT the stale campaigns.json
// mirror, whose session lists lag behind the DB. Sessions come back newest-first.
export function getAssistantRecaps(): AssistantRecap[] {
  try {
    return getActiveCampaigns()
      .map((campaign): AssistantRecap | null => {
        const latest = campaign.sessionSummaries?.[0];
        const summary = prepareForVoice(String(latest?.summary ?? ""));
        if (!latest || !summary) return null;
        return {
          name: campaign.name,
          aliases: campaign.aliases ?? [],
          title: String(latest.title ?? ""),
          summary,
        };
      })
      .filter((recap): recap is AssistantRecap => recap !== null);
  } catch {
    return [];
  }
}
