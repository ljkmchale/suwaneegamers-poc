export const USAGE_PURPOSES = [
  "schedule_planning",
  "campaign_followup",
  "session_catchup",
  "lore_research",
  "world_exploration",
  "character_roster",
  "community_information",
  "merchandise",
  "myra_assistance",
] as const;

export type UsagePurpose = (typeof USAGE_PURPOSES)[number];

export interface UsagePurposeSignal {
  purpose: UsagePurpose;
  signalType: "page" | "engagement" | "action" | "search" | "media" | "voice_question";
  confidence: number;
}

interface SitePurposeInput {
  eventType: string;
  path: string;
  contentType?: string;
  contentId?: string;
  contentLabel?: string;
  durationSeconds?: number;
}

function purposeForPath(path: string): UsagePurpose | null {
  if (/^\/calendar(?:\/|$)/.test(path)) return "schedule_planning";
  if (/^\/(?:campaigns|campaign-journeys)(?:\/|$)/.test(path)) return "campaign_followup";
  if (/^\/(?:advents_of_harmony|lore|pantheon|bestiary|reference-for-dungeon-masters)(?:\/|$)/.test(path)) return "lore_research";
  if (/^\/(?:gazetteer|maps-of-myrdae|organizations|territories|setting|campaign-setting)(?:\/|$)/.test(path)) return "world_exploration";
  if (/^\/(?:players|profile|dungeon-masters)(?:\/|$)/.test(path)) return "character_roster";
  if (/^\/store(?:\/|$)/.test(path)) return "merchandise";
  if (/^\/(?:history|about|ourstory)(?:\/|$)/.test(path)) return "community_information";
  return null;
}

function purposeForSearch(input: SitePurposeInput): UsagePurpose | null {
  const value = `${input.contentLabel ?? ""} ${input.contentId ?? ""}`.toLowerCase();
  if (/\b(?:when|calendar|schedule|next game|session date|playing)\b/.test(value)) return "schedule_planning";
  if (/\b(?:session|recap|recording|what happened|previous adventure)\b/.test(value)) return "session_catchup";
  if (/\b(?:character|player|roster|dungeon master|dm)\b/.test(value)) return "character_roster";
  if (/\b(?:campaign|party|quest|adventure)\b/.test(value)) return "campaign_followup";
  if (/\b(?:map|city|territory|organization|location|realm)\b/.test(value)) return "world_exploration";
  if (/\b(?:god|deity|lore|history|creature|npc|artifact|chronicle)\b/.test(value)) return "lore_research";
  return purposeForPath(input.path);
}

export function classifySitePurpose(input: SitePurposeInput): UsagePurposeSignal | null {
  if (input.eventType === "heartbeat" || input.eventType === "page_load" || input.eventType === "client_error") return null;

  if (["search_query", "search_result_click", "search_no_results"].includes(input.eventType)) {
    const purpose = purposeForSearch(input);
    return purpose ? { purpose, signalType: "search", confidence: 90 } : null;
  }

  if (["media_play", "media_progress", "media_complete"].includes(input.eventType)) {
    return { purpose: "session_catchup", signalType: "media", confidence: 95 };
  }

  const purpose = purposeForPath(input.path);
  if (!purpose) return null;
  if (input.eventType === "page_view") return { purpose, signalType: "page", confidence: 60 };
  if (input.eventType === "page_engagement" && (input.durationSeconds ?? 0) >= 15) {
    return { purpose, signalType: "engagement", confidence: 75 };
  }
  if (["internal_click", "outbound_click", "content_open", "content_view"].includes(input.eventType)) {
    return { purpose, signalType: "action", confidence: 85 };
  }
  return null;
}

export function classifyVoicePurpose(category: string): UsagePurposeSignal {
  const value = category.toLowerCase();
  let purpose: UsagePurpose = "myra_assistance";
  if (value.includes("schedule")) purpose = "schedule_planning";
  else if (value.includes("recap")) purpose = "session_catchup";
  else if (value.includes("campaign")) purpose = "campaign_followup";
  else if (/pantheon|site_knowledge|learned|lore/.test(value)) purpose = "lore_research";
  else if (value.includes("navigation")) purpose = "community_information";
  return { purpose, signalType: "voice_question", confidence: purpose === "myra_assistance" ? 70 : 95 };
}
