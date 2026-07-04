/**
 * Sync campaign session notes into SQLite by fetching the shared
 * Session Summaries Google Doc (configured as a managed source on /campaigns).
 *
 *   npx tsx apps/web/scripts/sync-session-notes.ts
 */
import { getDb } from "@/lib/db";
import { readContent } from "@/lib/contentFiles";
import type { AutoManagedPage } from "@/lib/autoManagedPages";

const DEFAULT_DOC_URL =
  "https://docs.google.com/document/d/1D7HTn5ZXjLGApClfwIyhT37hYfJCO_JvoBIqS4e_jfQ";

// ── Config ────────────────────────────────────────────────────────

function getSessionSummariesDocUrl(): string {
  try {
    const pages = readContent<AutoManagedPage[]>("auto-managed-pages.json");
    const campaignsPage = pages.find((p) => p.path === "/campaigns");
    const source = campaignsPage?.managedSources?.find((s) =>
      /session summaries/i.test(s.label),
    );
    return source?.url ?? DEFAULT_DOC_URL;
  } catch {
    return DEFAULT_DOC_URL;
  }
}

// ── Fetching ──────────────────────────────────────────────────────

function extractDocId(url: string): string | null {
  return /\/document\/d\/([a-zA-Z0-9_-]+)/.exec(url)?.[1] ?? null;
}

async function fetchGoogleDocAsMarkdown(docUrl: string): Promise<string> {
  const docId = extractDocId(docUrl);
  if (!docId) throw new Error(`Cannot extract doc ID from URL: ${docUrl}`);
  const res = await fetch(
    `https://docs.google.com/document/d/${docId}/export?format=md`,
    { redirect: "follow" },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching doc ${docId}`);
  return res.text();
}

// ── Parsing ───────────────────────────────────────────────────────

interface AudioLink {
  label: string;
  url: string;
}

interface ParsedSession {
  number: number;
  title: string;
  summary: string;
  audioLinks: AudioLink[];
}

interface ParsedCampaign {
  name: string;
  sessions: ParsedSession[];
}

function parseSessionSummariesDoc(markdown: string): ParsedCampaign[] {
  const campaigns: ParsedCampaign[] = [];

  // Split on H1 headings — each is a campaign section.
  const sections = markdown.split(/\n(?=# (?!#))/);

  for (const section of sections) {
    const firstLine = section.split("\n")[0].trim();
    if (!firstLine.startsWith("# ")) continue;
    const campaignName = firstLine.slice(2).replace(/\*+/g, "").trim();
    if (!campaignName) continue;

    const sessions: ParsedSession[] = [];

    // Split on H2 headings — each is a session entry.
    const blocks = section.split(/\n(?=## )/);
    for (const block of blocks.slice(1)) {
      const lines = block.split("\n");
      const heading = lines[0].trim();

      // Handles: "## **Session N – Title**", "## **Session N \-- Title**", "## **03 \- Title**"
      const m = heading.match(/^##\s+\*{0,2}(?:Session\s+)?(\d+)\s*(?:\\?[-–—])+\s*(.*?)\*{0,2}\s*$/i);
      if (!m) continue;

      const sessionNumber = parseInt(m[1], 10);
      const sessionTitle = m[2].replace(/\*+/g, "").trim();

      const audioLinks: AudioLink[] = [];
      const summaryParts: string[] = [];

      for (const line of lines.slice(1)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const audioMatch = trimmed.match(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/);
        if (audioMatch && /\.mp3|drive\.google\.com/i.test(audioMatch[2])) {
          audioLinks.push({ label: audioMatch[1], url: audioMatch[2] });
        } else {
          summaryParts.push(trimmed);
        }
      }

      const summary = summaryParts.join(" ").trim();
      if (!summary) continue;

      sessions.push({ number: sessionNumber, title: sessionTitle, summary, audioLinks });
    }

    if (sessions.length > 0) {
      campaigns.push({ name: campaignName, sessions });
    }
  }

  return campaigns;
}

// ── Matching + DB write ───────────────────────────────────────────

function norm(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\s+[-–—]\s+.+$/, "")  // strip subtitle (e.g. "Dungeons III - kNight Watch" → "Dungeons III")
    .replace(/[^a-z0-9]/g, "");
}

interface DbCampaign {
  id: string;
  name: string;
}

interface DbSession {
  sort_order: number;
  session_date: string | null;
  title: string;
  audio_links: string | null;
}

function syncToDb(parsed: ParsedCampaign[]): number {
  const db = getDb();
  const campaigns = db
    .prepare(`SELECT id, name FROM campaigns`)
    .all() as DbCampaign[];

  const normToId = new Map(campaigns.map((c) => [norm(c.name), c.id]));

  const getExisting = db.prepare(
    `SELECT sort_order, session_date, title, audio_links FROM session_summaries WHERE campaign_id = ? ORDER BY sort_order`,
  );
  const deleteSummaries = db.prepare(
    `DELETE FROM session_summaries WHERE campaign_id = ?`,
  );
  const insertSummary = db.prepare(`
    INSERT INTO session_summaries
      (campaign_id, title, summary, audio_links, auto, session_date, sort_order)
    VALUES
      (@campaign_id, @title, @summary, @audio_links, 0, @session_date, @sort_order)
  `);

  let updated = 0;

  for (const parsedCampaign of parsed) {
    const campaignId = normToId.get(norm(parsedCampaign.name));
    if (!campaignId) {
      console.warn(`✗ No campaign match for "${parsedCampaign.name}"`);
      continue;
    }

    // Preserve existing session dates and audio links (doc doesn't include them).
    const existing = getExisting.all(campaignId) as DbSession[];
    const dateByNumber = new Map<number, string>();
    const audioByNumber = new Map<number, string>();
    for (const row of existing) {
      const numMatch = row.title.match(/\d+/);
      if (numMatch) {
        const num = parseInt(numMatch[0], 10);
        if (row.session_date) dateByNumber.set(num, row.session_date);
        if (row.audio_links && row.audio_links !== "[]") audioByNumber.set(num, row.audio_links);
      }
    }

    db.transaction(() => {
      deleteSummaries.run(campaignId);
      for (const [index, session] of parsedCampaign.sessions.entries()) {
        const docAudio = session.audioLinks.length ? JSON.stringify(session.audioLinks) : null;
        insertSummary.run({
          campaign_id: campaignId,
          title: `Session ${session.number} - ${session.title}`,
          summary: session.summary,
          audio_links: docAudio ?? audioByNumber.get(session.number) ?? "[]",
          session_date: dateByNumber.get(session.number) ?? null,
          sort_order: index,
        });
      }
    })();

    console.log(
      `✓ ${campaignId}: wrote ${parsedCampaign.sessions.length} session(s).`,
    );
    updated++;
  }

  return updated;
}

// ── Entry point ───────────────────────────────────────────────────

async function main() {
  const docUrl = getSessionSummariesDocUrl();
  console.log(`Fetching session summaries from ${docUrl}`);

  const markdown = await fetchGoogleDocAsMarkdown(docUrl);
  const parsed = parseSessionSummariesDoc(markdown);

  if (parsed.length === 0) {
    console.error("No campaign sections found in doc — check the document format.");
    process.exitCode = 1;
    return;
  }

  console.log(`Found ${parsed.length} campaign section(s) in doc.`);
  const updated = syncToDb(parsed);
  console.log(`Done — updated ${updated} campaign(s).`);
}

main().catch((err) => {
  console.error(`Sync failed: ${(err as Error).message}`);
  process.exitCode = 1;
});
