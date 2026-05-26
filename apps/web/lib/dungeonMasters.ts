import fs from "fs";
import path from "path";
import { getActiveCampaigns } from "@/lib/campaigns";
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

function contentPath(filename: string) {
  return path.join(process.cwd(), "../../content", filename);
}

export function getDungeonMasters(): DungeonMasterProfile[] {
  const raw = fs.readFileSync(contentPath("dungeon-masters.json"), "utf-8");
  return JSON.parse(raw) as DungeonMasterProfile[];
}

// backward-compat export used by tests
export const dungeonMasters: DungeonMasterProfile[] = getDungeonMasters();

export function campaignsForDm(profile: DungeonMasterProfile) {
  return getActiveCampaigns().filter((campaign) =>
    profile.activeCampaignIds.includes(campaign.id)
  );
}

export const dungeonMastersReferenceUrl = `${PORTAL_URLS.referenceSite}dungeon-masters`;
