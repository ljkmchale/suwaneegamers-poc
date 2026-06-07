import { getPageLayout } from "@/lib/pageLayouts";

export interface ArchivedCampaignResource {
  label: string;
  url: string;
}

export interface ArchivedCampaignPartyMember {
  name: string;
  player?: string;
  url?: string;
}

export interface ArchivedCampaignSection {
  title: string;
  content?: string;
  entries?: string[];
}

export interface ArchivedCampaign {
  id: string;
  name: string;
  status: string;
  dm: string;
  description: string;
  referenceUrl?: string;
  headerImage?: string;
  resources: ArchivedCampaignResource[];
  party: ArchivedCampaignPartyMember[];
  sections: ArchivedCampaignSection[];
}

function parseArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export function getArchivedCampaigns(): ArchivedCampaign[] {
  return getPageLayout("/previous-campaigns").flatMap((item) => {
    if (item.kind !== "block" || item.type !== "archived-campaign-card") return [];
    const id = item.props.id as string | undefined;
    const name = item.props.title as string | undefined;
    if (!id || !name) return [];

    return [{
      id,
      name,
      status: (item.props.status as string | undefined) ?? "Completed",
      dm: (item.props.dm as string | undefined) ?? "",
      description: (item.props.description as string | undefined) ?? "",
      referenceUrl: item.props.referenceUrl as string | undefined,
      headerImage: item.props.image as string | undefined,
      resources: parseArray<ArchivedCampaignResource>(item.props.resources),
      party: parseArray<ArchivedCampaignPartyMember>(item.props.party),
      sections: parseArray<ArchivedCampaignSection>(item.props.sections),
    }];
  });
}

export function findArchivedCampaign(id: string) {
  return getArchivedCampaigns().find((campaign) => campaign.id === id);
}
