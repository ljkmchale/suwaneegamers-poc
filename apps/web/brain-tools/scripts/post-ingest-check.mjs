// Post-ingest connectivity check for a campaign.
// Finds missing NPC/item pages from session structured sections, creates stubs,
// and reports timeline, threads, and index gaps.
//
// Usage: node scripts/post-ingest-check.mjs [--campaign <name>] [--dry-run]
// Exported: checkCampaignConnectivity(campaign, options) for use in google-doc-sync

import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../src/config.mjs";

const wikiRoot = path.join(config.vaultRoot, "wiki");
const indexPath = path.join(config.vaultRoot, "index.md");

export async function checkCampaignConnectivity(campaign, { dryRun = false, silent = false } = {}) {
  const log = (...args) => { if (!silent) console.log(...args); };
  const issues = [];
  let stubsCreated = 0;

  // --- Find session pages ---
  const sessionDir = path.join(wikiRoot, "sessions", campaign);
  let sessionFiles;
  try {
    sessionFiles = (await fs.readdir(sessionDir))
      .filter(f => f.endsWith(".md"))
      .sort((a, b) => parseSessionNum(a) - parseSessionNum(b));
  } catch {
    return { issues: [{ severity: "error", message: `No sessions directory for ${campaign}` }], stubsCreated: 0 };
  }

  if (!sessionFiles.length) {
    return { issues: [{ severity: "warn", message: `No session pages for ${campaign}` }], stubsCreated: 0 };
  }

  const latestSessionNum = parseSessionNum(sessionFiles[sessionFiles.length - 1]);
  const latestSessionTitle = sessionFiles[sessionFiles.length - 1].replace(/\.md$/, "");
  log(`  Sessions: ${sessionFiles.length} | Latest: ${latestSessionTitle}`);

  // Build a full wiki page name lookup (used to avoid creating stubs for pages that exist elsewhere)
  const wikiPageNames = await buildWikiPageNameSet();

  // --- Parse every session for NPCs introduced and linked items ---
  const npcsToCheck = new Map();  // name → first session that introduced them
  const itemsToCheck = new Map(); // name → first session that named them

  for (const file of sessionFiles) {
    const content = await fs.readFile(path.join(sessionDir, file), "utf8");
    const sessionTitle = file.replace(/\.md$/, "");

    for (const name of extractLinksFromSection(content, "NPCs Introduced")) {
      if (!npcsToCheck.has(name)) npcsToCheck.set(name, sessionTitle);
    }
    for (const name of extractLinksFromSection(content, "Items Gained Or Lost")) {
      if (!isMetaLink(name) && !itemsToCheck.has(name)) itemsToCheck.set(name, sessionTitle);
    }
  }

  // --- Check NPC pages ---
  const npcDir = path.join(wikiRoot, "npcs", campaign);
  const existingNpcs = await getExistingPageNames(npcDir);

  for (const [name, source] of npcsToCheck) {
    if (!existingNpcs.has(normalizeKey(name)) && !wikiPageNames.has(normalizeKey(name))) {
      issues.push({ severity: "critical", type: "missing-npc", name, source });
      if (!dryRun) {
        await createStubPage(npcDir, name, campaign, source, "NPC");
        stubsCreated++;
        log(`  [STUB] wiki/npcs/${campaign}/${name}.md`);
      }
    }
  }
  if (npcsToCheck.size && !issues.some(i => i.type === "missing-npc")) {
    log(`  [OK]   All introduced NPCs have pages (${npcsToCheck.size} checked)`);
  }

  // --- Check item pages ---
  const itemDir = path.join(wikiRoot, "items", campaign);
  const existingItems = await getExistingPageNames(itemDir);

  for (const [name, source] of itemsToCheck) {
    if (!existingItems.has(normalizeKey(name)) && !wikiPageNames.has(normalizeKey(name))) {
      issues.push({ severity: "critical", type: "missing-item", name, source });
      if (!dryRun) {
        await createStubPage(itemDir, name, campaign, source, "item");
        stubsCreated++;
        log(`  [STUB] wiki/items/${campaign}/${name}.md`);
      }
    }
  }
  if (itemsToCheck.size && !issues.some(i => i.type === "missing-item")) {
    log(`  [OK]   All linked items have pages (${itemsToCheck.size} checked)`);
  }

  // --- Timeline currency ---
  const timelineName = `${campaign} Timeline.md`;
  const timelinePath = path.join(wikiRoot, "timelines", timelineName);
  try {
    const timelineContent = await fs.readFile(timelinePath, "utf8");
    const timelineLatest = findHighestSessionNum(timelineContent);
    if (timelineLatest < latestSessionNum) {
      issues.push({
        severity: "critical",
        type: "stale-timeline",
        message: `Timeline covers through Session ${timelineLatest}, but sessions go through Session ${latestSessionNum}`
      });
    } else {
      log(`  [OK]   Timeline current (through Session ${timelineLatest})`);
    }
  } catch {
    issues.push({ severity: "critical", type: "missing-timeline", message: `Timeline file missing: wiki/timelines/${timelineName}` });
  }

  // --- Open Threads currency ---
  const threadsPath = path.join(wikiRoot, "threads", "Open Threads By Campaign.md");
  try {
    const threadsContent = await fs.readFile(threadsPath, "utf8");
    const campaignSection = extractCampaignSection(threadsContent, campaign);
    if (!campaignSection) {
      issues.push({ severity: "warn", type: "missing-threads-section", message: `No ${campaign} section in Open Threads By Campaign` });
    } else {
      const threadsLatest = findHighestSessionNum(campaignSection);
      // Only warn if the section contains a session number that's behind — no numbers means unversioned (OK)
      if (threadsLatest > 0 && latestSessionNum > 1 && threadsLatest < latestSessionNum - 1) {
        issues.push({
          severity: "warn",
          type: "stale-threads",
          message: `Open Threads last references Session ${threadsLatest}; sessions go through Session ${latestSessionNum}`
        });
      } else {
        log(`  [OK]   Open Threads current`);
      }
    }
  } catch {
    issues.push({ severity: "warn", type: "missing-threads", message: `Open Threads By Campaign.md not found` });
  }

  // --- Index.md session coverage ---
  // Normalize both sides so punctuation differences (!, ?, &, apostrophes) don't cause false misses
  const indexContent = await fs.readFile(indexPath, "utf8").catch(() => "");
  const indexNorm = normalizeKey(indexContent);
  const missingSessions = sessionFiles
    .map(f => f.replace(/\.md$/, ""))
    .filter(title => !indexNorm.includes(normalizeKey(title)));

  if (missingSessions.length) {
    for (const title of missingSessions) {
      issues.push({ severity: "warn", type: "missing-from-index", message: `Not in index.md: [[${title}]]` });
    }
  } else {
    log(`  [OK]   All ${sessionFiles.length} sessions in index.md`);
  }

  return { issues, stubsCreated };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractLinksFromSection(content, sectionName) {
  const match = content.match(
    new RegExp(`##\\s+${escapeRegex(sectionName)}[^\n]*\n([\\s\\S]*?)(?=\n##\\s|$)`, "i")
  );
  if (!match) return [];
  const links = new Set();
  const re = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
  let m;
  while ((m = re.exec(match[1])) !== null) {
    const name = m[1].trim();
    if (name) links.add(name);
  }
  return [...links];
}

function isMetaLink(name) {
  return /^(HoE|SoD|TSV|WB|D3|TCB|Dungeons III|Bloody Endeavor|The Crystal Bottle|The Silent Vanguard|Heroes of Emberstran|Souls of Destiny)\s+Session/i.test(name)
    || /Campaign Player Notes/i.test(name)
    || /Timeline$/i.test(name)
    || /Quick Reference$/i.test(name);
}

async function getExistingPageNames(dir) {
  const names = new Set();
  try {
    for (const f of await fs.readdir(dir)) {
      if (f.endsWith(".md")) names.add(normalizeKey(f.slice(0, -3)));
    }
  } catch { /* dir may not exist */ }
  return names;
}

async function buildWikiPageNameSet() {
  const names = new Set();
  async function walk(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) await walk(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        names.add(normalizeKey(entry.name.slice(0, -3)));
      }
    }
  }
  await walk(wikiRoot);
  return names;
}

async function createStubPage(dir, name, campaign, sourceSession, type) {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${name}.md`);
  try { await fs.access(filePath); return; } catch { /* doesn't exist — create it */ }

  const content = [
    `---`,
    `title: "${name}"`,
    `campaign: ${campaign}`,
    `visibility: players`,
    `stub: true`,
    `---`,
    ``,
    `# ${name}`,
    ``,
    `Campaign: ${campaign}`,
    `Status: Stub — needs full ingest.`,
    `First appeared: [[${sourceSession}]]`,
    ``,
    `## Overview`,
    ``,
    `*This ${type} page was auto-generated as a stub and needs a full ingest pass. See [[${sourceSession}]] for context.*`,
    ``
  ].join("\n");

  await fs.writeFile(filePath, content, "utf8");
}

function parseSessionNum(filename) {
  const m = filename.match(/Session\s+(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : 0;
}

function findHighestSessionNum(text) {
  const matches = [...text.matchAll(/Session\s+(\d+(?:\.\d+)?)/gi)];
  return matches.length ? Math.max(...matches.map(m => parseFloat(m[1]))) : 0;
}

function extractCampaignSection(content, campaign) {
  const lines = content.split("\n");
  const normCampaign = normalizeKey(campaign);
  let inSection = false;
  const sectionLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      // Match heading if it contains the campaign code or name
      const headingNorm = normalizeKey(h2[1]);
      const isMatch = headingNorm.includes(normCampaign) || normCampaign.includes(headingNorm);
      if (isMatch) {
        inSection = true;
        continue;
      } else if (inSection) {
        break; // Hit next campaign section
      }
    }
    if (inSection) sectionLines.push(line);
  }

  return sectionLines.length ? sectionLines.join("\n") : null;
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (process.argv[1] && path.basename(process.argv[1]) === "post-ingest-check.mjs") {
  const args = process.argv.slice(2);
  const campIdx = args.indexOf("--campaign");
  const campaignArg = campIdx !== -1 ? args[campIdx + 1] : null;
  const dryRun = args.includes("--dry-run");

  async function main() {
    let campaigns;
    if (campaignArg) {
      campaigns = [campaignArg];
    } else {
      const sessionsDir = path.join(wikiRoot, "sessions");
      campaigns = (await fs.readdir(sessionsDir, { withFileTypes: true }))
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();
    }

    let totalIssues = 0;
    let totalStubs = 0;

    for (const campaign of campaigns) {
      console.log(`\n${"─".repeat(54)}`);
      console.log(`Campaign: ${campaign}`);

      const { issues, stubsCreated } = await checkCampaignConnectivity(campaign, { dryRun });
      totalIssues += issues.length;
      totalStubs += stubsCreated;

      if (issues.length) {
        console.log(`\n  Issues (${issues.length}):`);
        for (const issue of issues) {
          const icon = issue.severity === "critical" ? "❌" : "⚠️ ";
          const msg = issue.message
            ?? `Missing ${issue.type?.replace(/-/g, " ")}: ${issue.name}${issue.source ? ` (from ${issue.source})` : ""}`;
          console.log(`  ${icon} ${msg}`);
        }
      } else {
        console.log(`\n  ✅ All clear`);
      }
    }

    console.log(`\n${"─".repeat(54)}`);
    console.log(`Total issues: ${totalIssues} | Stubs created: ${totalStubs}`);
    if (dryRun && totalStubs === 0 && totalIssues > 0) {
      console.log(`(dry-run: no files written)`);
    }
    if (totalIssues > 0) process.exitCode = 1;
  }

  main().catch(err => { console.error(err.stack ?? err.message); process.exitCode = 1; });
}
