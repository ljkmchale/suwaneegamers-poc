import fs from "fs";
import path from "path";
import { getActiveCampaigns, type CampaignPartyMember, type PortalCampaign } from "@/lib/campaigns";
import { getDungeonMasters } from "@/lib/dungeonMasters";

export interface PlayerProfileSeed {
  id: string;
  name: string;
  description: string;
  portrait?: string;
}

export interface PlayerCharacterAssignment {
  character: CampaignPartyMember;
  campaign: PortalCampaign;
}

export interface PlayerProfile extends PlayerProfileSeed {
  dmProfileId?: string;
  portrait?: string;
  assignments: PlayerCharacterAssignment[];
}

function contentPath(filename: string) {
  return path.join(process.cwd(), "../../content", filename);
}

export function getPlayerProfileSeeds(): PlayerProfileSeed[] {
  const raw = fs.readFileSync(contentPath("players.json"), "utf-8");
  return JSON.parse(raw) as PlayerProfileSeed[];
}

// backward-compat export used by tests
export const playerProfileSeeds: PlayerProfileSeed[] = getPlayerProfileSeeds();

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function assignmentsForPlayer(playerName: string): PlayerCharacterAssignment[] {
  return getActiveCampaigns().flatMap((campaign) =>
    (campaign.party ?? [])
      .filter((character) => character.player === playerName)
      .map((character) => ({ character, campaign })),
  );
}

export function getPlayerProfiles(): PlayerProfile[] {
  const seeds = getPlayerProfileSeeds();
  const dms = getDungeonMasters();

  return seeds
    .map((seed) => {
      const dmProfile = dms.find((profile) => profile.name === seed.name);

      return {
        ...seed,
        dmProfileId: dmProfile?.id,
        portrait: seed.portrait ?? dmProfile?.portrait,
        assignments: assignmentsForPlayer(seed.name),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getUnassignedCharacters() {
  return getActiveCampaigns().flatMap((campaign) =>
    (campaign.party ?? [])
      .filter((character) => !character.player)
      .map((character) => ({ character, campaign })),
  );
}

export function ensurePlayerSeed(name: string): PlayerProfileSeed {
  return {
    id: slugify(name),
    name,
    description: `Suwanee Gamers player with active character information in the portal.`,
  };
}
