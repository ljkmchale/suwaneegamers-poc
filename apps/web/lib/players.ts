import { activeCampaigns, type CampaignPartyMember, type PortalCampaign } from "@/lib/campaigns";
import { dungeonMasters } from "@/lib/dungeonMasters";

export interface PlayerProfileSeed {
  id: string;
  name: string;
  description: string;
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

export const playerProfileSeeds: PlayerProfileSeed[] = [
  {
    id: "sean-poole",
    name: "Sean Poole",
    description: "Suwanee Gamers player and Dungeon Master with active stories on both sides of the screen.",
  },
  {
    id: "larry-mchale",
    name: "Larry McHale",
    description: "Suwanee Gamers player, archived campaign steward, and portal maintainer.",
  },
  {
    id: "lesley-poole",
    name: "Lesley Poole",
    description: "Suwanee Gamers player and Dungeon Master with a focus on active table play and campaign continuity.",
  },
  {
    id: "josh",
    name: "Josh",
    description: "Suwanee Gamers player with an active character in the Heroes of Emberstran campaign.",
  },
  {
    id: "emma",
    name: "Emma",
    description: "Suwanee Gamers player with an active character in the Heroes of Emberstran campaign.",
  },
  {
    id: "ty",
    name: "Ty",
    description: "Suwanee Gamers player with an active character in the Heroes of Emberstran campaign.",
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assignmentsForPlayer(playerName: string): PlayerCharacterAssignment[] {
  return activeCampaigns.flatMap((campaign) =>
    (campaign.party ?? [])
      .filter((character) => character.player === playerName)
      .map((character) => ({ character, campaign })),
  );
}

export function getPlayerProfiles(): PlayerProfile[] {
  return playerProfileSeeds
    .map((seed) => {
      const dmProfile = dungeonMasters.find((profile) => profile.name === seed.name);

      return {
        ...seed,
        dmProfileId: dmProfile?.id,
        portrait: dmProfile?.portrait,
        assignments: assignmentsForPlayer(seed.name),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getUnassignedCharacters() {
  return activeCampaigns.flatMap((campaign) =>
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
