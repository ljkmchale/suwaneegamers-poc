import type { ArchivedCampaign } from "@/lib/archivedCampaigns";
import type { PortalCampaign } from "@/lib/campaigns";
import { getConfiguredManagedSourceUrl } from "@/lib/autoManagedPagesData";

export const DEFAULT_CAMPAIGN_TRACKING_DOCUMENT_URL =
  "https://docs.google.com/document/d/1OCKi_nV-Qv1Zqg7koEbEX8yaURrV2DgieohO2RgNyGo/edit?usp=sharing";
export const CAMPAIGN_TRACKING_DOCUMENT_URL =
  process.env.CAMPAIGN_TRACKING_DOCUMENT_URL ?? DEFAULT_CAMPAIGN_TRACKING_DOCUMENT_URL;

export const CAMPAIGN_TRACKING_REVALIDATE_SECONDS = 24 * 60 * 60;

export type CampaignTrackingStatus = "Active" | "Completed" | "On Hiatus";

export interface CampaignTrackingEntry {
  name: string;
  status: CampaignTrackingStatus;
  dm: string;
}

const DM_NAME_FIXES = new Map([
  ["lesely poole", "Lesley Poole"],
  ["tom chernetzky", "Tom Chernetsky"],
]);

function clean(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function trackingKey(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeStatus(value: string): CampaignTrackingStatus | null {
  const status = clean(value).toLowerCase();
  if (status === "active") return "Active";
  if (status === "complete" || status === "completed") return "Completed";
  if (status === "on hiatus") return "On Hiatus";
  return null;
}

function normalizeDmName(value: string) {
  const dm = clean(value);
  return DM_NAME_FIXES.get(dm.toLowerCase()) ?? dm;
}

export function getCampaignTrackingDocumentUrl() {
  return process.env.CAMPAIGN_TRACKING_DOCUMENT_URL
    ?? getConfiguredManagedSourceUrl(
      "/campaigns",
      /campaign tracking/i,
      DEFAULT_CAMPAIGN_TRACKING_DOCUMENT_URL,
    );
}

export function campaignTrackingExportUrl(documentUrl = getCampaignTrackingDocumentUrl()) {
  const id = documentUrl.match(/\/document\/d\/([^/]+)/)?.[1] ?? documentUrl;
  return `https://docs.google.com/document/d/${id}/export?format=txt`;
}

export function parseCampaignTrackingText(text: string): CampaignTrackingEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
  const dmHeaderIndex = lines.findIndex((line, index) => {
    return line.toLowerCase() === "dm" && lines[index - 1]?.toLowerCase() === "status";
  });
  const rows = dmHeaderIndex >= 0 ? lines.slice(dmHeaderIndex + 1) : lines;
  const entries: CampaignTrackingEntry[] = [];

  for (let index = 0; index < rows.length; index += 3) {
    const name = rows[index];
    const status = normalizeStatus(rows[index + 1] ?? "");
    const dm = rows[index + 2];

    if (!name || !status || !dm) continue;
    entries.push({ name, status, dm: normalizeDmName(dm) });
  }

  return entries;
}

export async function fetchCampaignTrackingEntries(): Promise<CampaignTrackingEntry[]> {
  const response = await fetch(campaignTrackingExportUrl(), {
    next: { revalidate: CAMPAIGN_TRACKING_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Campaign Tracking document returned ${response.status}`);
  }

  return parseCampaignTrackingText(await response.text());
}

function campaignKeys(campaign: Pick<PortalCampaign, "id" | "name" | "aliases">) {
  return [
    campaign.id,
    campaign.name,
    ...(campaign.aliases ?? []),
  ].map(trackingKey);
}

function entryMap(entries: CampaignTrackingEntry[]) {
  return new Map(entries.map((entry) => [trackingKey(entry.name), entry]));
}

export function applyCampaignTrackingToActiveCampaigns(
  campaigns: PortalCampaign[],
  entries: CampaignTrackingEntry[],
): PortalCampaign[] {
  const byKey = entryMap(entries);

  return campaigns.flatMap((campaign) => {
    if (campaign.official === false) return [campaign];

    const entry = campaignKeys(campaign).map((key) => byKey.get(key)).find(Boolean);
    if (!entry) return [campaign];
    if (entry.status !== "Active") return [];

    return [{ ...campaign, name: entry.name, dm: entry.dm }];
  });
}

export function applyCampaignTrackingToArchivedCampaigns(
  campaigns: ArchivedCampaign[],
  entries: CampaignTrackingEntry[],
): ArchivedCampaign[] {
  const byKey = entryMap(entries);

  return campaigns.map((campaign) => {
    const entry = byKey.get(trackingKey(campaign.name));
    return entry
      ? { ...campaign, name: entry.name, status: entry.status, dm: entry.dm }
      : campaign;
  });
}

export async function getTrackedActiveCampaigns(
  campaigns: PortalCampaign[],
): Promise<PortalCampaign[]> {
  try {
    return applyCampaignTrackingToActiveCampaigns(campaigns, await fetchCampaignTrackingEntries());
  } catch {
    return campaigns;
  }
}

export async function getTrackedArchivedCampaigns(
  campaigns: ArchivedCampaign[],
): Promise<ArchivedCampaign[]> {
  try {
    return applyCampaignTrackingToArchivedCampaigns(campaigns, await fetchCampaignTrackingEntries());
  } catch {
    return campaigns;
  }
}

export async function findTrackedCampaign(
  campaigns: PortalCampaign[],
  id: string,
): Promise<PortalCampaign | undefined> {
  return (await getTrackedActiveCampaigns(campaigns)).find((campaign) => campaign.id === id);
}
