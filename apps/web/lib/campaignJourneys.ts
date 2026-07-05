import { readContent } from "@/lib/contentFiles";

export type CampaignImpactType =
  | "arcane"
  | "battle"
  | "discovery"
  | "political"
  | "rescue"
  | "warning";

export interface CampaignImpact {
  type: CampaignImpactType;
  title: string;
  description: string;
}

export interface CampaignJourneyStop {
  id: string;
  locationId?: string;
  location: string;
  x: number;
  y: number;
  realm?: "surface" | "underdark";
  precision?: "approximate" | "off-map";
  session: string;
  realDate?: string;
  title: string;
  summary: string;
  current?: boolean;
  impact?: CampaignImpact;
  automatic?: boolean;
  confidence?: number;
  route?: {
    mode:
      | "direct"
      | "local"
      | "off-map"
      | "portal"
      | "realm-transition"
      | "road"
      | "water";
    points: Array<{ x: number; y: number }>;
    miles?: number;
    days?: number;
    roadIds?: string[];
    roadNames?: string[];
  };
  sourceKey?: string;
  sourceHash?: string;
}

export interface CampaignLocationHint {
  id: string;
  locationId?: string;
  location: string;
  x: number;
  y: number;
  realm?: "surface" | "underdark";
  precision?: "approximate" | "off-map";
  session: string;
}

export interface CampaignJourney {
  id: string;
  name: string;
  color: string;
  status: string;
  campaignHref: string;
  mapStatus?: string;
  locationHints?: CampaignLocationHint[];
  stops: CampaignJourneyStop[];
}

export interface CampaignLocationImpactHistory {
  id: string;
  locationId?: string;
  location: string;
  x: number;
  y: number;
  realm: "surface" | "underdark";
  campaignIds: string[];
  crossCampaign: boolean;
  impacts: Array<{
    campaignId: string;
    campaignName: string;
    session: string;
    title: string;
    type: CampaignImpactType;
    description: string;
  }>;
}

export interface CampaignJourneysDocument {
  title: string;
  subtitle: string;
  mapImage: string;
  campaigns: CampaignJourney[];
  locationImpacts?: CampaignLocationImpactHistory[];
  sync?: {
    mode: "automatic";
    lastGeneratedAt: string;
    sessionSource: string;
    mapSource: string;
    generatedStops: number;
    routedSegments?: number;
    impactLocations?: number;
  };
}

export function getCampaignJourneys(): CampaignJourneysDocument {
  return readContent<CampaignJourneysDocument>("campaign-journeys.json");
}
