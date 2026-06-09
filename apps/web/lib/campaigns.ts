import fs from "fs";
import type { CalendarEvent } from "@/lib/calendar";
import { contentPath } from "@/lib/contentFiles";

export interface CampaignSessionSummary {
  title: string;
  summary: string;
  audioLinks?: {
    label: string;
    url: string;
  }[];
}

export interface CampaignResourceLink {
  label: string;
  url: string;
}

export interface CampaignPartyMember {
  name: string;
  player?: string;
  url?: string;
}

export interface PortalCampaign {
  id: string;
  name: string;
  dm: string;
  schedule: string;
  description: string;
  referenceUrl: string;
  headerImage?: string;
  headerImagePosition?: string;
  official?: boolean;
  resources?: CampaignResourceLink[];
  party?: CampaignPartyMember[];
  sessionSummaries?: CampaignSessionSummary[];
  aliases?: string[];
}

export function getActiveCampaigns(): PortalCampaign[] {
  const raw = fs.readFileSync(contentPath("campaigns.json"), "utf-8");
  return JSON.parse(raw) as PortalCampaign[];
}

// backward-compat export used by tests; server pages should call getActiveCampaigns() directly
export const activeCampaigns: PortalCampaign[] = getActiveCampaigns();

export function listedCampaigns() {
  return getActiveCampaigns().filter((c) => c.official !== false);
}

export function sideCampaigns() {
  return getActiveCampaigns().filter((c) => c.official === false);
}

export function findCampaign(id: string) {
  return getActiveCampaigns().find((c) => c.id === id);
}

export function normalizeCampaignTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findNextCampaignEvent(
  campaign: PortalCampaign,
  events: CalendarEvent[]
): CalendarEvent | undefined {
  const names = [campaign.name, ...(campaign.aliases ?? [])].map(normalizeCampaignTitle);

  return events
    .filter((event) => {
      const title = normalizeCampaignTitle(event.title);
      return names.some((name) => title === name || title.includes(name));
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
}

export function findCampaignForCalendarEvent(
  event: CalendarEvent,
  campaigns: PortalCampaign[] = getActiveCampaigns()
): PortalCampaign | undefined {
  const title = normalizeCampaignTitle(event.title);

  return campaigns.find((campaign) => {
    const names = [campaign.name, ...(campaign.aliases ?? [])].map(normalizeCampaignTitle);
    return names.some((name) => title === name || title.includes(name));
  });
}

const LEGACY_STOP_MARKERS = [
  "Previous Characters",
  "Old Notes",
  "Google Sites",
  "Report abuse",
  "Page details",
  "Page updated",
];

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function legacyHtmlToLines(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "\n")
  )
    .replace(/ /g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractLegacySections(html: string) {
  return html.match(/<section\b[\s\S]*?<\/section>/gi) ?? [];
}

function normalizeLegacyHref(href: string) {
  const decoded = decodeHtmlEntities(href);

  try {
    const url = new URL(decoded);
    const wrappedUrl = url.searchParams.get("q");
    return wrappedUrl ?? decoded;
  } catch {
    return decoded;
  }
}

function legacyAnchorText(html: string) {
  return legacyHtmlToLines(html).join(" ").trim();
}

function extractLegacyAudioLinks(html: string) {
  const links: CampaignSessionSummary["audioLinks"] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const url = normalizeLegacyHref(match[2]);
    const isAudioCandidate =
      /drive\.google\.com\/file\/d\//i.test(url) ||
      /\.(mp3|m4a|wav|ogg)(?:[?#].*)?$/i.test(url);

    if (!isAudioCandidate || seen.has(url)) continue;

    seen.add(url);
    links.push({
      label: legacyAnchorText(match[3]) || "Session Audio",
      url,
    });
  }

  return links;
}

function isSessionStart(line: string, nextLine = "") {
  if (/^session\s*\d/i.test(line)) return true;
  if (/^\d{1,2}\s*[-–—]/.test(line)) return true;
  return /^\d$/.test(line) && (/^\d$/.test(nextLine) || /^[-–—]$/.test(nextLine));
}

function titleNeedsMore(parts: string[]) {
  const title = parts.join(" ");
  return !/[-–—]\s*\S.{2,}/.test(title);
}

function normalizeSessionTitle(parts: string[]) {
  return parts
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/^Session\s+(\d)\s+(\d)\b/i, "Session $1$2")
    .replace(/^(\d)\s+(\d)\s*[-–—]/, "$1$2 -")
    .replace(/\s*[-–—]\s*/g, " - ")
    .trim();
}

function parseLegacySessionSummaries(lines: string[]): CampaignSessionSummary[] {
  const sessionHeadingIndex = lines.findIndex((line) => line.toLowerCase() === "session summaries");
  const firstSessionIndex = lines.findIndex((line, index) => isSessionStart(line, lines[index + 1]));
  let cursor = sessionHeadingIndex >= 0 ? sessionHeadingIndex + 1 : firstSessionIndex;

  if (cursor < 0) return [];

  const stopIndex = lines.findIndex(
    (line, index) => index > cursor && LEGACY_STOP_MARKERS.some((marker) => line === marker)
  );
  const end = stopIndex >= 0 ? stopIndex : lines.length;
  const summaries: CampaignSessionSummary[] = [];

  while (cursor < end) {
    const line = lines[cursor];
    const nextLine = lines[cursor + 1];

    if (!isSessionStart(line, nextLine)) {
      cursor += 1;
      continue;
    }

    const titleParts = [line];
    cursor += 1;

    while (cursor < end && titleNeedsMore(titleParts)) {
      titleParts.push(lines[cursor]);
      cursor += 1;
    }

    const summaryParts: string[] = [];
    while (cursor < end && !isSessionStart(lines[cursor], lines[cursor + 1])) {
      if (!LEGACY_STOP_MARKERS.some((marker) => lines[cursor] === marker)) {
        summaryParts.push(lines[cursor]);
      }
      cursor += 1;
    }

    const title = normalizeSessionTitle(titleParts);
    const summary = summaryParts.join(" ").replace(/\s+/g, " ").trim();

    if (title && summary) {
      summaries.push({ title, summary });
    }
  }

  return summaries;
}

export function parseLegacyCampaignSessionSummariesFromHtml(html: string) {
  const summaries = extractLegacySections(html).flatMap((sectionHtml) => {
    const parsed = parseLegacySessionSummaries(legacyHtmlToLines(sectionHtml));
    if (parsed.length === 0) return [];

    const audioLinks = extractLegacyAudioLinks(sectionHtml);
    if (audioLinks.length === 0) return parsed;

    return parsed.map((summary) => ({
      ...summary,
      audioLinks,
    }));
  });

  if (summaries.length > 0) return summaries;

  return parseLegacySessionSummaries(legacyHtmlToLines(html));
}

export async function fetchLegacyCampaignSessionSummaries(campaign: PortalCampaign) {
  try {
    const response = await fetch(campaign.referenceUrl, {
      next: { revalidate: 300 },
    });

    if (!response.ok) return campaign.sessionSummaries ?? [];

    const html = await response.text();
    const parsed = parseLegacyCampaignSessionSummariesFromHtml(html);
    return parsed.length > 0 ? parsed : campaign.sessionSummaries ?? [];
  } catch {
    return campaign.sessionSummaries ?? [];
  }
}
