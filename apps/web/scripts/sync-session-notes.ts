/**
 * Sync campaign session notes into content/campaigns.json from two sources:
 *
 * 1. The legacy Google Sites pages (curated DM summaries). Only campaigns
 *    that had a calendar event within the lookback window (--days N, default
 *    2) are checked, or every campaign with --all. New sessions are added;
 *    stored entries are never overwritten — except auto-generated ones,
 *    which an official summary for the same session replaces.
 *
 * 2. The Campaign Brain vault's raw player notes (pulled daily from the
 *    players' Google Docs). Sessions newer than anything stored are
 *    summarized headlessly via the Claude CLI and added with `auto: true`
 *    so the morning-after notes appear before the DM posts official ones.
 *
 *   npx tsx scripts/sync-session-notes.ts            # campaigns that just played
 *   npx tsx scripts/sync-session-notes.ts --days 7   # wider lookback
 *   npx tsx scripts/sync-session-notes.ts --all      # every campaign
 *   npx tsx scripts/sync-session-notes.ts --no-ai    # skip the Claude summarization phase
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import {
  filterCalendarEventsForWindow,
  googleCalendarIcsUrl,
  parseIcsEvents,
  type CalendarEvent,
} from "@/lib/calendar";
import {
  findPreviousCampaignEvent,
  getActiveCampaigns,
  parseLegacyCampaignSessionSummariesFromHtml,
  type CampaignSessionSummary,
  type PortalCampaign,
} from "@/lib/campaigns";
import { writeContent } from "@/lib/contentFiles";

const RAW_NOTES_DIR =
  process.env.CAMPAIGN_BRAIN_RAW_DIR ??
  "C:\\Users\\Larry McHale\\Desktop\\dnd-campaign-brain\\D&D Campaign Brain\\raw";

/** Campaign id → raw player-notes file in the Campaign Brain vault. */
const RAW_NOTES_FILES: Record<string, string> = {
  "heroes-of-emberstran": "hoe-campaign-player-notes.md",
  "dungeons-iii": "dungeons-iii-campaign-player-notes.md",
  "souls-of-destiny": "sod-campaign-player-notes.md",
  "bloody-endeavor": "bloody-endeavor-campaign-player-notes.md",
  "the-silent-vanguard": "the-silent-vanguard-player-reference.md",
};

interface CliOptions {
  all: boolean;
  days: number;
  ai: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const all = argv.includes("--all");
  const ai = !argv.includes("--no-ai");
  const daysIndex = argv.indexOf("--days");
  const days = daysIndex >= 0 ? Number.parseInt(argv[daysIndex + 1] ?? "", 10) : 2;

  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("--days must be a positive integer");
  }

  return { all, days, ai };
}

/**
 * Identity for a session note so the same session parsed with slightly
 * different title formatting (e.g. "Session 3 - Foo" vs "3 - Foo") doesn't
 * get added twice. Numbered sessions key on the session number; unnumbered
 * ones key on the normalized title text.
 */
function sessionKey(title: string): string {
  const num = title.match(/\d+/);
  if (num) return `n:${Number.parseInt(num[0], 10)}`;
  return `t:${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
}

async function fetchPastEvents(days: number): Promise<CalendarEvent[]> {
  const res = await fetch(googleCalendarIcsUrl());
  if (!res.ok) {
    throw new Error(`Google Calendar feed returned ${res.status}`);
  }

  const ics = await res.text();
  const now = new Date();
  const window = {
    start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    end: now,
  };

  return filterCalendarEventsForWindow(parseIcsEvents(ics, window), window);
}

async function fetchLatestNotes(campaign: PortalCampaign) {
  const res = await fetch(campaign.referenceUrl);
  if (!res.ok) {
    throw new Error(`${campaign.referenceUrl} returned ${res.status}`);
  }

  return parseLegacyCampaignSessionSummariesFromHtml(await res.text());
}

// ── Phase 1: curated summaries from the Google Sites pages ────────────────

async function syncOfficialNotes(
  campaigns: PortalCampaign[],
  options: CliOptions
): Promise<number> {
  let targets: PortalCampaign[];
  if (options.all) {
    targets = campaigns.filter((campaign) => campaign.referenceUrl);
  } else {
    const pastEvents = await fetchPastEvents(options.days);
    targets = campaigns.filter(
      (campaign) =>
        campaign.referenceUrl && findPreviousCampaignEvent(campaign, pastEvents)
    );
    console.log(
      `${targets.length} campaign(s) had a session in the last ${options.days} day(s).`
    );
  }

  let updated = 0;

  for (const target of targets) {
    const stored = target.sessionSummaries ?? [];

    let parsed;
    try {
      parsed = await fetchLatestNotes(target);
    } catch (error) {
      console.error(`✗ ${target.id}: fetch failed — ${(error as Error).message}`);
      continue;
    }

    if (parsed.length === 0) {
      console.warn(`✗ ${target.id}: no session notes parsed from page, skipping.`);
      continue;
    }

    // Only add sessions that aren't stored yet. Stored entries are curated
    // (better labels, hand-tuned text) and must never be overwritten — the
    // exception is auto-generated entries, which the official summary for
    // the same session replaces.
    const storedByKey = new Map(stored.map((note) => [sessionKey(note.title), note]));
    const fresh: CampaignSessionSummary[] = [];
    let replaced = 0;

    for (const note of parsed) {
      const existing = storedByKey.get(sessionKey(note.title));
      if (!existing) {
        fresh.push(note);
      } else if (existing.auto) {
        const index = stored.indexOf(existing);
        stored[index] = { ...note, sessionDate: existing.sessionDate };
        replaced += 1;
      }
    }

    if (fresh.length === 0 && replaced === 0) {
      console.log(`· ${target.id}: already up to date (${stored.length} notes).`);
      continue;
    }

    target.sessionSummaries = [...fresh, ...stored];
    updated += 1;
    const parts = [
      fresh.length > 0 ? `added ${fresh.length} new note(s)` : "",
      replaced > 0 ? `replaced ${replaced} auto note(s) with official ones` : "",
    ].filter(Boolean);
    console.log(`✓ ${target.id}: ${parts.join(", ")}.`);
  }

  return updated;
}

// ── Phase 2: auto-summaries from Campaign Brain raw player notes ───────────

interface RawSessionBlock {
  number: number;
  titleHint: string;
  date?: Date;
  body: string;
}

function localIsoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseRawSessionDate(value: string): Date | undefined {
  const cleaned = value.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1").trim();
  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * The player docs contain year typos (old sessions dated a year ahead, e.g.
 * "October 10, 2026" for a session played in 2025). A session more than 30
 * days in the future can't be real — subtract a year. Genuinely upcoming
 * session stubs (within 30 days) are left alone so they stay filtered out.
 */
function correctedSessionDate(date: Date, now = new Date()): Date {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (date.getTime() > now.getTime() + thirtyDaysMs) {
    return new Date(date.getFullYear() - 1, date.getMonth(), date.getDate());
  }
  return date;
}

export function parseRawSessionBlocks(text: string): RawSessionBlock[] {
  const lines = text.split(/\r?\n/);
  const starts: { index: number; number: number; titleHint: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(/^(\d{1,2})\s*[-–—]\s*(.*)$/);
    if (!match) continue;

    const nextLine = (lines[i + 1] ?? "").trim();
    const hasDateLine = /^Session Date:/i.test(nextLine);
    const hasInlineDate = /\(\d{2}\.\d{2}\.\d{2}\)\s*$/.test(match[2]);
    if (hasDateLine || hasInlineDate) {
      starts.push({ index: i, number: Number(match[1]), titleHint: match[2] });
    }
  }

  return starts.map((start, idx) => {
    const endIndex = idx + 1 < starts.length ? starts[idx + 1].index : lines.length;
    const bodyLines = lines.slice(start.index + 1, endIndex);
    const stopAt = bodyLines.findIndex((line) =>
      /the end of the session|^we stop here/i.test(line.trim())
    );

    let date: Date | undefined;
    const dateLine = bodyLines
      .slice(0, 3)
      .find((line) => /^Session Date:/i.test(line.trim()));
    if (dateLine) {
      date = parseRawSessionDate(dateLine.trim().replace(/^Session Date:\s*/i, ""));
    } else {
      const inline = start.titleHint.match(/\((\d{2})\.(\d{2})\.(\d{2})\)\s*$/);
      if (inline) {
        date = new Date(2000 + Number(inline[3]), Number(inline[1]) - 1, Number(inline[2]));
      }
    }

    return {
      number: start.number,
      titleHint: start.titleHint.replace(/\s*\([\d.\/]+\)\s*$/, "").trim(),
      date,
      body: (stopAt >= 0 ? bodyLines.slice(0, stopAt) : bodyLines).join("\n").trim(),
    };
  });
}

function maxStoredSessionNumber(stored: CampaignSessionSummary[]): number {
  return stored.reduce((max, note) => {
    const num = note.title.match(/\d+/);
    return num ? Math.max(max, Number.parseInt(num[0], 10)) : max;
  }, 0);
}

function isPlaceholderTitle(title: string): boolean {
  return title.length === 0 || /^(name|tbd|\?+|<[^>]*>)$/i.test(title);
}

function formatSessionTitle(stored: CampaignSessionSummary[], number: number, title: string) {
  const usesSessionPrefix = /^session\b/i.test(stored[0]?.title ?? "Session");
  return usesSessionPrefix
    ? `Session ${number} - ${title}`
    : `${String(number).padStart(2, "0")} - ${title}`;
}

function summarizeWithClaude(
  campaignName: string,
  block: RawSessionBlock
): { title: string; summary: string } | null {
  const titleInstruction = isPlaceholderTitle(block.titleHint)
    ? 'Invent a short, evocative 3-7 word session title in the style of D&D session names (puns and player quotes welcome).'
    : `The players titled this session "${block.titleHint}" — keep that title (you may fix obvious typos).`;

  const prompt = [
    `Below are raw player notes from a session of the tabletop D&D campaign "${campaignName}".`,
    "Write a spoiler-light recap for the group's public website.",
    titleInstruction,
    "Respond with ONLY a JSON object, no markdown fences, in this exact shape:",
    '{"title": "<session title, without any session number>", "summary": "<2-4 sentence past-tense summary of the session\'s key events, naming important characters and places>"}',
    "",
    "RAW PLAYER NOTES:",
    block.body.slice(0, 16000),
  ].join("\n");

  const result = spawnSync("claude -p", {
    input: prompt,
    encoding: "utf-8",
    shell: true,
    windowsHide: true,
    timeout: 300000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error || result.status !== 0) {
    console.error(
      `  claude CLI failed (${result.error?.message ?? `exit ${result.status}`}): ${(result.stderr ?? "").slice(0, 300)}`
    );
    return null;
  }

  const json = (result.stdout ?? "").match(/\{[\s\S]*\}/);
  if (!json) {
    console.error(`  claude CLI returned no JSON: ${(result.stdout ?? "").slice(0, 200)}`);
    return null;
  }

  try {
    const parsed = JSON.parse(json[0]) as { title?: unknown; summary?: unknown };
    if (typeof parsed.title !== "string" || typeof parsed.summary !== "string") return null;
    const title = parsed.title.replace(/^session\s*\d+\s*[-–—:]\s*/i, "").trim();
    const summary = parsed.summary.trim();
    return title && summary ? { title, summary } : null;
  } catch {
    console.error(`  claude CLI returned invalid JSON.`);
    return null;
  }
}

function syncRawNotes(campaigns: PortalCampaign[]): number {
  if (!fs.existsSync(RAW_NOTES_DIR)) {
    console.warn(`Campaign Brain raw notes dir not found (${RAW_NOTES_DIR}), skipping AI phase.`);
    return 0;
  }

  const now = new Date();
  let updated = 0;

  for (const campaign of campaigns) {
    const rawFile = RAW_NOTES_FILES[campaign.id];
    if (!rawFile) continue;

    const fullPath = path.join(RAW_NOTES_DIR, rawFile);
    if (!fs.existsSync(fullPath)) {
      console.warn(`✗ ${campaign.id}: raw notes file missing (${rawFile}).`);
      continue;
    }

    const rawText = fs.readFileSync(fullPath, "utf-8");

    // Keep the campaign's link to the players' full notes doc current — the
    // raw file header records which Google Doc it was pulled from.
    const sourceUrl = rawText.match(/Source:\s*\[[^\]]*\]\((https[^)]+)\)/i)?.[1];
    if (sourceUrl && campaign.playerNotesUrl !== sourceUrl) {
      campaign.playerNotesUrl = sourceUrl;
      updated += 1;
      console.log(`✓ ${campaign.id}: player notes link set to ${sourceUrl}`);
    }

    const stored = campaign.sessionSummaries ?? [];
    const blocks = parseRawSessionBlocks(rawText).map((block) =>
      block.date ? { ...block, date: correctedSessionDate(block.date, now) } : block
    );

    // Backfill session dates onto stored notes from the raw blocks' Session
    // Date lines (matched by session number) so the site can show when each
    // session was played. Existing dates that disagree are corrected too —
    // the raw notes are the source of truth for when a session happened.
    const dateByNumber = new Map(
      blocks
        .filter((block) => block.date)
        .map((block) => [block.number, localIsoDate(block.date as Date)])
    );
    let datesAdded = 0;
    for (const note of stored) {
      const num = note.title.match(/\d+/);
      const date = num ? dateByNumber.get(Number.parseInt(num[0], 10)) : undefined;
      if (date && note.sessionDate !== date) {
        note.sessionDate = date;
        datesAdded += 1;
      }
    }
    if (datesAdded > 0) {
      updated += 1;
      console.log(`✓ ${campaign.id}: backfilled ${datesAdded} session date(s) from raw notes.`);
    }

    const maxStored = maxStoredSessionNumber(stored);
    const seen = new Set<number>();
    const newBlocks: RawSessionBlock[] = blocks
      .filter((block) => {
        if (block.number <= maxStored || seen.has(block.number)) return false;
        seen.add(block.number);
        // Skip future-session stubs and blocks too thin to summarize.
        if (block.date && block.date > now) return false;
        return block.body.length >= 400;
      })
      .sort((a, b) => a.number - b.number);

    if (newBlocks.length === 0) continue;

    const generated: CampaignSessionSummary[] = [];
    for (const block of newBlocks) {
      console.log(`… ${campaign.id}: summarizing session ${block.number} from raw notes via Claude.`);
      const result = summarizeWithClaude(campaign.name, block);
      if (!result) continue;

      generated.unshift({
        title: formatSessionTitle(stored, block.number, result.title),
        summary: result.summary,
        auto: true,
        sessionDate: block.date ? localIsoDate(block.date) : undefined,
      });
    }

    if (generated.length === 0) continue;

    campaign.sessionSummaries = [...generated, ...stored];
    updated += 1;
    for (const note of generated) {
      console.log(`✓ ${campaign.id}: auto-added "${note.title}".`);
    }
  }

  return updated;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const campaigns = getActiveCampaigns();

  let updated = await syncOfficialNotes(campaigns, options);
  if (options.ai) {
    updated += syncRawNotes(campaigns);
  }

  if (updated > 0) {
    writeContent("campaigns.json", campaigns);
    console.log(`Wrote campaigns.json (${updated} campaign update(s)).`);
  } else {
    console.log("No changes written.");
  }
}

main().catch((error) => {
  console.error(`Sync failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
