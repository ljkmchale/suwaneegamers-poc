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
  previous_campaigns: string;
}

interface DbCampaignDmRow {
  campaign_id: string;
  dm_id: string;
}

function rowToDm(row: DbDmRow, activeCampaignIds: string[]): DungeonMasterProfile {
  return {
    id: row.id,
    name: row.name,
    focus: row.focus,
    description: row.description,
    portrait: row.portrait ?? undefined,
    activeCampaignIds,
    previousCampaigns: JSON.parse(row.previous_campaigns) as DungeonMasterProfile["previousCampaigns"],
  };
}

export function getDungeonMasters(): DungeonMasterProfile[] {
  const db = getDb();
  const dmRows = db.prepare(`SELECT * FROM dungeon_masters ORDER BY rowid`).all() as DbDmRow[];
  const assignmentRows = db.prepare(`SELECT campaign_id, dm_id FROM campaign_dms`).all() as DbCampaignDmRow[];

  const campaignsByDm = new Map<string, string[]>();
  for (const row of assignmentRows) {
    const arr = campaignsByDm.get(row.dm_id) ?? [];
    arr.push(row.campaign_id);
    campaignsByDm.set(row.dm_id, arr);
  }

  return dmRows.map((row) => rowToDm(row, campaignsByDm.get(row.id) ?? []));
}

// backward-compat export used by tests
export const dungeonMasters: DungeonMasterProfile[] = getDungeonMasters();

export function campaignsForDm(profile: DungeonMasterProfile) {
  return getActiveCampaigns().filter((campaign) =>
    profile.activeCampaignIds.includes(campaign.id)
  );
}

export const dungeonMastersReferenceUrl = `${PORTAL_URLS.referenceSite}dungeon-masters`;
