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

/**
 * Every distinct player name that appears in the synced roster (across all
 * campaigns, plus unmatched rows). The sheet carries fuller names than
 * players.json (e.g. "Brian Winniford" vs "Brian"), so this is the better
 * source for deciding whether a signed-in member is a known roster player.
 */
export function getRosterPlayerNames(): string[] {
  const file = readRosterFile();
  if (!file) return [];
  const names = new Set<string>();
  const collect = (characters: RosterCharacter[]) => {
    for (const character of characters) {
      const player = character.player?.trim();
      if (player) names.add(player);
    }
  };
  for (const entry of Object.values(file.campaigns)) collect(entry.characters);
  for (const characters of Object.values(file.unmatched ?? {})) collect(characters);
  return [...names];
}
