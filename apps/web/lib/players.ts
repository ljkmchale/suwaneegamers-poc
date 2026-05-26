import { activeCampaigns, type CampaignPartyMember, type PortalCampaign } from "@/lib/campaigns";
import { dungeonMasters } from "@/lib/dungeonMasters";

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
    id: "joshua-john",
    name: "Joshua John",
    description: "Suwanee Gamers player with an active character in the Heroes of Emberstran campaign.",
  },
  {
    id: "emma-cooper",
    name: "Emma Cooper",
    description: "Suwanee Gamers player with an active character in the Heroes of Emberstran campaign.",
    portrait: "/images/emma-cooper-clean.webp",
  },
  {
    id: "ty-cooper",
    name: "Ty Cooper",
    description: "Suwanee Gamers player with an active character in the Heroes of Emberstran campaign.",
    portrait: "/images/ty-cooper-clean.webp",
  },
  {
    id: "chip-poole",
    name: "Chip Poole",
    description: "Suwanee Gamers player and Dungeon Master with active stories on both sides of the screen.",
  },
  {
    id: "brian",
    name: "Brian",
    description: "Suwanee Gamers player with active character information in the portal.",
  },
  {
    id: "cooper",
    name: "Cooper",
    description: "Suwanee Gamers player with active character information in the portal.",
  },
  {
    id: "chuck",
    name: "Chuck",
    description: "Suwanee Gamers player with active character information in the portal.",
  },
  {
    id: "suzanne-chernetsky",
    name: "Suzanne Chernetsky",
    description: "Suwanee Gamers player with active character information in the portal.",
  },
  {
    id: "jenny-mchale",
    name: "Jenny McHale",
    description: "Suwanee Gamers player with active character information in the portal.",
    portrait: "/images/jenny-mchale-profile-v2.webp",
  },
  {
    id: "mike-brown",
    name: "Mike Brown",
    description: "Suwanee Gamers player with active character information in the portal.",
    portrait: "/images/mike-brown-clean.webp",
  },
  {
    id: "michael-hewson",
    name: "Michael Hewson",
    description: "Suwanee Gamers player and Dungeon Master with active stories on both sides of the screen.",
  },
  {
    id: "tom-chernetsky",
    name: "Tom Chernetsky",
    description: "Suwanee Gamers player with an active character in the Dungeons III campaign.",
    portrait: "/images/tom-chernetsky-profile-v3.webp",
  },
  {
    id: "tiffany-mulvihill",
    name: "Tiffany Mulvihill",
    description: "Suwanee Gamers player with active character information in the portal.",
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
        portrait: seed.portrait ?? dmProfile?.portrait,
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
