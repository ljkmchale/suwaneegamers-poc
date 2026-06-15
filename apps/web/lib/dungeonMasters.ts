import { getActiveCampaigns } from "@/lib/campaigns";
import { getDb } from "@/lib/db";
import { PORTAL_URLS } from "@/lib/portal";

export interface DungeonMasterProfile {
  id: string;
  name: string;
  focus: string;
  description: string;
  portrait?: string;
  activeCampaignIds: string[];
  previousCampaigns: {
    name: string;
    status: "Completed" | "On Hiatus";
  }[];
}

interface DbDmRow {
  id: string;
  name: string;
  focus: string;
  description: string;
  portrait: string | null;
  active_campaign_ids: string;
  previous_campaigns: string;
}

function rowToDm(row: DbDmRow): DungeonMasterProfile {
  return {
    id: row.id,
    name: row.name,
    focus: row.focus,
    description: row.description,
    portrait: row.portrait ?? undefined,
    activeCampaignIds: JSON.parse(row.active_campaign_ids) as string[],
    previousCampaigns: JSON.parse(row.previous_campaigns) as DungeonMasterProfile["previousCampaigns"],
  };
}

export function getDungeonMasters(): DungeonMasterProfile[] {
  return (getDb().prepare(`SELECT * FROM dungeon_masters ORDER BY rowid`).all() as DbDmRow[]).map(rowToDm);
}

// backward-compat export used by tests
export const dungeonMasters: DungeonMasterProfile[] = getDungeonMasters();

export function campaignsForDm(profile: DungeonMasterProfile) {
  return getActiveCampaigns().filter((campaign) =>
    profile.activeCampaignIds.includes(campaign.id)
  );
}

export const dungeonMastersReferenceUrl = `${PORTAL_URLS.referenceSite}dungeon-masters`;
