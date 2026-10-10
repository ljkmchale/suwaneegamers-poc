// Deterministic, verbatim session publication. Never infer attendance or lore.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseFrontmatter } from "./markdown.mjs";

const OWNER = "session-pages-v1";
const safe = (text) => String(text).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\.+$/, "").trim();
const numberOf = (text) => Number(String(text).match(/\bSession\s+(\d+(?:\.\d+)?)/i)?.[1]);

export function extractNoteSessions(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headers = [];
  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index].trim().replace(/^#{1,6}\s+/, "");
    const match = heading.match(/^(?:Session\s+)?(\d+(?:\.\d+)?)\s*[-–—]\s*(.*)$/i);
    if (!match || Number(match[1]) <= 0) continue;
    // A numbered inventory/list item is not a session. Require the source's
    // date field near the heading or a parenthesized date in the heading.
    const following = lines.slice(index + 1, index + 6).join("\n");
    if (!/^\s*(?:Session|Real) Date\s*:/mi.test(following) &&
        !/\(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\)/.test(match[2])) continue;
    headers.push({ index, number: Number(match[1]), title: match[2].trim() });
  }
  return headers.map((header, offset) => {
    const block = lines.slice(header.index + 1, headers[offset + 1]?.index ?? lines.length);
    const endMarker = /(?:The End of the Session|The Session Ends Here)/i;
    const appendix = /^\s*(?:#{1,6}\s*)?(?:[❕📜🫅]|DM Brief\b|Session 0\b|Session Summar(?:y|ies)\s*$|Goals\s*$|Quests\s*$|NPCs\s*$)/i;
    const stop = block.findIndex(line => endMarker.test(line) || appendix.test(line));
    const body = (stop < 0 ? block : block.slice(0, stop + (endMarker.test(block[stop]) ? 1 : 0))).join("\n").trim();
    return { ...header, body };
  }).filter((session) => session.body.length > 40);
}

export async function syncSessionPages({ vaultRoot, dataDir, sources, campaigns }) {
  let prior = {};
  try { prior = JSON.parse(await fs.readFile(path.join(dataDir, "session-freshness.json"), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  let written = 0;
  const report = [];
  for (const campaign of campaigns) {
    const source = sources.find((item) => item.enabled !== false && item.campaign === campaign.vaultCampaign);
    const notes = source ? extractNoteSessions(await fs.readFile(path.join(vaultRoot, "raw", source.filename), "utf8")) : [];
    const desired = new Map();
    for (const row of campaign.sessions) {
      const number = numberOf(row.title);
      if (number > 0 && row.summary?.trim()) desired.set(number, {
        number, title: row.title, body: row.summary.trim(), kind: "approved-session-summary",
        provenance: `SQLite session_summaries / ${campaign.id} / ${row.title}`,
      });
    }
    for (const session of notes) {
      const fallbackTitle = desired.get(session.number)?.title;
      const title = /^\([\d./-]+\)$/.test(session.title) ? (fallbackTitle || `Session ${session.number}`) :
        `Session ${String(session.number).padStart(2, "0")} - ${session.title}`;
      desired.set(session.number, { ...session, title, kind: "verbatim-player-notes",
        provenance: `raw/${source.filename} / ${source.url}` });
    }
    if (!desired.size) continue;
    const directory = path.join(vaultRoot, "wiki", "sessions", safe(campaign.vaultCampaign));
    await fs.mkdir(directory, { recursive: true });
    const existing = new Map();
    for (const name of await fs.readdir(directory)) {
      if (!name.endsWith(".md")) continue;
      const text = await fs.readFile(path.join(directory, name), "utf8");
      const number = numberOf(text.match(/^#\s+(.+)$/m)?.[1] || name);
      if (number > 0) existing.set(number, { name, text });
    }
    for (const [number, session] of desired) {
      const previous = existing.get(number);
      // Curated sessions remain intact. Only this generator's pages are updated.
      if (previous && !previous.text.includes(`generated_by: ${OWNER}`)) continue;
      const hash = createHash("sha256").update(`${session.kind}\n${session.title}\n${session.provenance}\n${session.body}`).digest("hex");
      if (previous?.text.includes(`source_hash: ${hash}`)) continue;
      const name = previous?.name || `${safe(campaign.vaultCampaign)} ${safe(session.title)}.md`;
      const content = ["---", `campaign: "${campaign.vaultCampaign}"`, "visibility: players",
        `generated_by: ${OWNER}`, `source_kind: ${session.kind}`, `source_hash: ${hash}`,
        "---", "", `# ${session.title}`, "", `Source: ${session.provenance}`, "",
        session.kind === "approved-session-summary" ? "## Approved Session Summary" : "## Verbatim Session Notes",
        "", session.body, ""].join("\n");
      const destination = path.join(directory, name);
      const temporary = `${destination}.${process.pid}.tmp`;
      await fs.writeFile(temporary, content);
      await fs.rename(temporary, destination);
      existing.set(number, { name, text: content });
      written++;
    }
    const noteLatest = Math.max(0, ...notes.map((item) => item.number));
    const summaryLatest = Math.max(0, ...campaign.sessions.map((row) => numberOf(row.title) || 0));
    const latest = Math.max(...desired.keys(), ...existing.keys());
    const latestPage = existing.get(latest);
    const latestMeta = latestPage ? parseFrontmatter(latestPage.text) : null;
    const bodyHash = latestMeta ? createHash("sha256").update(latestMeta.body).digest("hex") : "";
    const old = prior.campaigns?.find((item) => item.vaultCampaign === campaign.vaultCampaign)?.latestSession;
    report.push({ campaign: campaign.name, vaultCampaign: campaign.vaultCampaign,
      latestNotes: noteLatest, latestSummary: summaryLatest, latestPublished: latest,
      latestSession: latestPage ? {
        title: latestPage.text.match(/^#\s+(.+)$/m)?.[1] || latestPage.name.replace(/\.md$/, ""),
        path: `wiki/sessions/${safe(campaign.vaultCampaign)}/${latestPage.name}`,
        bodyHash,
        visibility: latestMeta.frontmatter.visibility || latestMeta.frontmatter.audience || latestMeta.frontmatter.access || "players",
        indexedAt: old?.bodyHash === bodyHash ? old.indexedAt || null : null,
      } : null,
      summaryBehindNotes: noteLatest > summaryLatest });
  }
  await fs.mkdir(dataDir, { recursive: true });
  await writeReport(dataDir, {
    generatedAt: new Date().toISOString(), campaigns: report,
  });
  return { written, campaigns: report };
}

async function writeReport(dataDir, report) {
  const destination = path.join(dataDir, "session-freshness.json");
  const temporary = `${destination}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(report, null, 2) + "\n");
  await fs.rename(temporary, destination);
}

export async function markSessionPagesIndexed({ dataDir, index }) {
  try {
    const report = JSON.parse(await fs.readFile(path.join(dataDir, "session-freshness.json"), "utf8"));
    for (const campaign of report.campaigns ?? []) {
      const session = campaign.latestSession;
      if (session) session.indexedAt = index.fileHashes[session.path] === session.bodyHash &&
        index.pages[session.path]?.visibility === "players" ? index.createdAt : null;
    }
    await writeReport(dataDir, report);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
}
