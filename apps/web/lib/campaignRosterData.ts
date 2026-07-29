// Server-only reads for the synced campaign roster (content/campaign-roster.json,
// written by scripts/sync-campaign-roster.mjs). Pure helpers live in campaignRoster.ts.

import { readContent } from "@/lib/contentFiles";
import type { CampaignRosterFile, RosterCharacter } from "@/lib/campaignRoster";

function readRosterFile(): CampaignRosterFile | undefined {
  try {
    return readContent<CampaignRosterFile>("campaign-roster.json");
  } catch {
    // File not synced yet — pages render without roster data.
    return undefined;
  }
}

/** Roster characters for a campaign id (active or archived). Empty until synced. */
export function getCampaignRoster(campaignId: string): RosterCharacter[] {
  return readRosterFile()?.campaigns[campaignId]?.characters ?? [];
}

/** All rosters keyed by campaign id, for list pages. */
export function getAllCampaignRosters(): Record<string, RosterCharacter[]> {
  const file = readRosterFile();
  if (!file) return {};
  return Object.fromEntries(
    Object.entries(file.campaigns).map(([id, entry]) => [id, entry.characters])
  );
}
