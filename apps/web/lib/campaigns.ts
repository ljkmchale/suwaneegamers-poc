import type { CalendarEvent } from "@/lib/calendar";
import { getDb } from "@/lib/db";

export interface CampaignSessionSummary {
  title: string;
  summary: string;
  audioLinks?: {
    label: string;
    url: string;
  }[];
  /** True when the summary was auto-generated from raw player notes; replaced when the DM posts an official one. */
  auto?: boolean;
  /** Date the session was played, as a local YYYY-MM-DD string. */
  sessionDate?: string;
}

export interface CampaignResourceLink {
  label: string;
  url: string;
}

export type CampaignPartyLinkType = "sheet" | "background" | "other";

export interface CampaignPartyLink {
  label: string;
  type: CampaignPartyLinkType;
  url: string;
}

export interface CampaignPartyMember {
  name: string;
  player?: string;
  links?: CampaignPartyLink[];
  /** Legacy character-sheet link. Prefer links[]. */
  url?: string;
}

export interface PortalCampaign {
  id: string;
  name: string;
  dm: string;
  schedule: string;
  description: string;
  headerImage?: string;
  headerImagePosition?: string;
  headerImageSourceFolder?: string;
  headerImageSourceFileId?: string;
  headerImageSourceFileName?: string;
  official?: boolean;
  /** Google Doc with the players' full running session notes. */
  playerNotesUrl?: string;
  resources?: CampaignResourceLink[];
  party?: CampaignPartyMember[];
  sessionSummaries?: CampaignSessionSummary[];
  aliases?: string[];
}

// ---------------------------------------------------------------------------
// Internal DB row types
// ---------------------------------------------------------------------------

interface DbCampaignRow {
  id: string;
  name: string;
  dm: string;
  schedule: string;
  description: string;
  header_image: string | null;
  header_image_position: string;
  header_image_source_folder: string | null;
  header_image_source_file_id: string | null;
  header_image_source_file_name: string | null;
  official: number;
  player_notes_url: string | null;
  aliases: string;
  resources: string;
  party: string;
}

interface DbSummaryRow {
  id: number;
  campaign_id: string;
  title: string;
  summary: string;
  audio_links: string;
  auto: number;
  session_date: string | null;
  sort_order: number;
}

function rowToCampaign(c: DbCampaignRow, summaries: CampaignSessionSummary[]): PortalCampaign {
  return {
    id: c.id,
    name: c.name,
    dm: c.dm,
    schedule: c.schedule,
    description: c.description,
    headerImage: c.header_image ?? undefined,
    headerImagePosition: c.header_image_position ?? undefined,
    headerImageSourceFolder: c.header_image_source_folder ?? undefined,
    headerImageSourceFileId: c.header_image_source_file_id ?? undefined,
    headerImageSourceFileName: c.header_image_source_file_name ?? undefined,
    official: Boolean(c.official),
    playerNotesUrl: c.player_notes_url ?? undefined,
    aliases: JSON.parse(c.aliases) as string[],
    resources: JSON.parse(c.resources) as CampaignResourceLink[],
    party: JSON.parse(c.party) as CampaignPartyMember[],
    sessionSummaries: summaries,
  };
}

function rowToSummary(s: DbSummaryRow): CampaignSessionSummary {
  return {
    title: s.title,
    summary: s.summary,
    audioLinks: JSON.parse(s.audio_links) as CampaignSessionSummary["audioLinks"],
    auto: s.auto ? true : undefined,
    sessionDate: s.session_date ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getActiveCampaigns(): PortalCampaign[] {
  const db = getDb();
  const campaignRows = db.prepare(
    `SELECT * FROM campaigns ORDER BY rowid`
  ).all() as DbCampaignRow[];

  const summaryRows = db.prepare(
    `SELECT * FROM session_summaries ORDER BY campaign_id, sort_order`
  ).all() as DbSummaryRow[];

  const summariesByCampaign = new Map<string, CampaignSessionSummary[]>();
  for (const s of summaryRows) {
    const arr = summariesByCampaign.get(s.campaign_id) ?? [];
    arr.push(rowToSummary(s));
    summariesByCampaign.set(s.campaign_id, arr);
  }

  return campaignRows.map((c) => rowToCampaign(c, summariesByCampaign.get(c.id) ?? []));
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
  const db = getDb();
  const c = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id) as DbCampaignRow | undefined;
  if (!c) return undefined;

  const summaryRows = db.prepare(
    `SELECT * FROM session_summaries WHERE campaign_id = ? ORDER BY sort_order`
  ).all(id) as DbSummaryRow[];

  return rowToCampaign(c, summaryRows.map(rowToSummary));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export function updateCampaignHeaderImage(
  id: string,
  headerImage?: string,
  headerImagePosition?: string
): boolean {
  const db = getDb();
  const nextImage = headerImage?.trim() || null;
  const nextPosition = headerImagePosition?.trim() || "center";

  const result = db.prepare(`
    UPDATE campaigns
    SET header_image = @header_image, header_image_position = @header_image_position
    WHERE id = @id
      AND (header_image IS NOT @header_image OR header_image_position != @header_image_position)
  `).run({ id, header_image: nextImage, header_image_position: nextPosition });

  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Pure helpers (no I/O)
// ---------------------------------------------------------------------------

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

export function findPreviousCampaignEvent(
  campaign: PortalCampaign,
  pastEvents: CalendarEvent[]
): CalendarEvent | undefined {
  const names = [campaign.name, ...(campaign.aliases ?? [])].map(normalizeCampaignTitle);

  return pastEvents
    .filter((event) => {
      const title = normalizeCampaignTitle(event.title);
      return names.some((name) => title === name || title.includes(name));
    })
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0];
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

// ---------------------------------------------------------------------------
// Legacy session summary parsing (unchanged — pure string processing)
// ---------------------------------------------------------------------------

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
    .replace(/ /g, " ")
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
    .replace(/\s+[-–—]+\s*|[-–—]+\s+|[-–—]{2,}/g, " - ")
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

