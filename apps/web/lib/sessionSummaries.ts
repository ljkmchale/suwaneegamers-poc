import {
  getActiveCampaigns,
  normalizeCampaignTitle,
  type CampaignSessionSummary,
  type PortalCampaign,
} from "@/lib/campaigns";
import { getConfiguredManagedSourceUrl } from "@/lib/autoManagedPagesData";

export const DEFAULT_SESSION_SUMMARIES_DOCUMENT_URL =
  "https://docs.google.com/document/d/1D7HTn5ZXjLGApClfwIyhT37hYfJCO_JvoBIqS4e_jfQ";
export const SESSION_SUMMARIES_DOCUMENT_URL =
  process.env.SESSION_SUMMARIES_DOCUMENT_URL ?? DEFAULT_SESSION_SUMMARIES_DOCUMENT_URL;
export const SESSION_SUMMARIES_REVALIDATE_SECONDS = 24 * 60 * 60;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, "\"")
    .replace(/&ldquo;/g, "\"");
}

function htmlText(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExportedHref(value: string) {
  const decoded = decodeHtmlEntities(value);

  try {
    const url = new URL(decoded);
    return url.searchParams.get("q") ?? decoded;
  } catch {
    return decoded;
  }
}

function extractAudioLinks(html: string): NonNullable<CampaignSessionSummary["audioLinks"]> {
  const links: NonNullable<CampaignSessionSummary["audioLinks"]> = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const url = normalizeExportedHref(match[2]);
    const label = htmlText(match[3]) || "Session Recording";
    const isAudio =
      /drive\.google\.com\/file\/d\//i.test(url) ||
      /\.(mp3|m4a|wav|ogg)(?:[?#].*)?$/i.test(url) ||
      /\.(mp3|m4a|wav|ogg)\b/i.test(label);

    if (!isAudio || seen.has(url)) continue;

    seen.add(url);
    links.push({ label, url });
  }

  return links;
}

function campaignIdForTitle(title: string, campaigns: PortalCampaign[]) {
  const normalizedTitle = normalizeCampaignTitle(title);

  return campaigns.find((campaign) => {
    const names = [campaign.name, ...(campaign.aliases ?? [])].map(normalizeCampaignTitle);
    return names.some((name) => name === normalizedTitle);
  })?.id;
}

function sessionKey(title: string): string {
  const num = title.match(/\d+/);
  if (num) return `n:${Number.parseInt(num[0], 10)}`;
  return `t:${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
}

function preserveStoredSessionFields(
  parsed: CampaignSessionSummary[],
  stored: CampaignSessionSummary[] = [],
) {
  const storedByKey = new Map(stored.map((note) => [sessionKey(note.title), note]));

  return parsed.map((note) => {
    const storedNote = storedByKey.get(sessionKey(note.title));
    return {
      ...note,
      audioLinks: note.audioLinks?.length ? note.audioLinks : storedNote?.audioLinks,
      sessionDate: storedNote?.sessionDate,
    };
  });
}

export function parseSessionSummariesDocumentHtml(
  html: string,
  campaigns: PortalCampaign[],
): Record<string, CampaignSessionSummary[]> {
  const result: Record<string, CampaignSessionSummary[]> = {};
  const tokenPattern = /<(h1|h2|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let currentCampaignId: string | undefined;
  let currentSession: CampaignSessionSummary | undefined;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(html))) {
    const [, tag, body] = match;
    const text = htmlText(body);

    if (tag === "h1") {
      currentCampaignId = campaignIdForTitle(text, campaigns);
      currentSession = undefined;
      if (currentCampaignId) result[currentCampaignId] ??= [];
      continue;
    }

    if (!currentCampaignId) continue;

    if (tag === "h2") {
      currentSession = { title: text, summary: "" };
      result[currentCampaignId].push(currentSession);
      continue;
    }

    if (!currentSession) continue;

    const audioLinks = extractAudioLinks(body);
    if (audioLinks.length) {
      currentSession.audioLinks = [
        ...(currentSession.audioLinks ?? []),
        ...audioLinks,
      ];
      continue;
    }

    if (text) {
      currentSession.summary = [currentSession.summary, text].filter(Boolean).join(" ");
    }
  }

  for (const campaignId of Object.keys(result)) {
    result[campaignId] = result[campaignId].filter((session) => session.title && session.summary);
  }

  return result;
}

export function getSessionSummariesDocumentUrl() {
  return process.env.SESSION_SUMMARIES_DOCUMENT_URL
    ?? getConfiguredManagedSourceUrl(
      "/campaigns",
      /session summaries/i,
      DEFAULT_SESSION_SUMMARIES_DOCUMENT_URL,
    );
}

export function googleDocHtmlExportUrl(documentUrl = getSessionSummariesDocumentUrl()) {
  const id = documentUrl.match(/\/document\/d\/([^/]+)/)?.[1] ?? documentUrl;
  return `https://docs.google.com/document/d/${id}/export?format=html`;
}

export async function fetchSessionSummariesByCampaign(
  campaigns: PortalCampaign[] = getActiveCampaigns(),
): Promise<Record<string, CampaignSessionSummary[]>> {
  const response = await fetch(googleDocHtmlExportUrl(), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Session Summaries document returned ${response.status}`);
  }

  return parseSessionSummariesDocumentHtml(await response.text(), campaigns);
}

export async function getCampaignsWithDocumentSessionSummaries(
  campaigns: PortalCampaign[] = getActiveCampaigns(),
): Promise<PortalCampaign[]> {
  try {
    const summariesByCampaign = await fetchSessionSummariesByCampaign(campaigns);
    return campaigns.map((campaign) => ({
      ...campaign,
      sessionSummaries: summariesByCampaign[campaign.id]
        ? preserveStoredSessionFields(summariesByCampaign[campaign.id], campaign.sessionSummaries)
        : campaign.sessionSummaries,
    }));
  } catch {
    return campaigns;
  }
}

export async function fetchSessionSummariesForCampaign(
  campaign: PortalCampaign,
): Promise<CampaignSessionSummary[]> {
  try {
    const summariesByCampaign = await fetchSessionSummariesByCampaign(getActiveCampaigns());
    return summariesByCampaign[campaign.id]
      ? preserveStoredSessionFields(summariesByCampaign[campaign.id], campaign.sessionSummaries)
      : campaign.sessionSummaries ?? [];
  } catch {
    return campaign.sessionSummaries ?? [];
  }
}
