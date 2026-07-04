import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "./config.mjs";
import {
  fetchGoogleDocText,
  hashGoogleDocText,
  upsertSourceRegistry,
  writeGoogleDocTextToRaw
} from "./google-docs.mjs";
import { processPendingRawSources } from "./process-raw-sources.mjs";
import { checkCampaignConnectivity } from "../scripts/post-ingest-check.mjs";

let syncInProgress = false;

export function startGoogleDocAutoSync() {
  if (!config.autoPullGoogleDocs) {
    console.log("Google Docs auto-sync disabled.");
    return;
  }

  const intervalMs = Math.max(1, config.autoPullGoogleDocsIntervalHours) * 60 * 60 * 1000;
  const startupDelayMs = Math.max(0, config.autoPullGoogleDocsStartupDelayMs);

  setTimeout(() => {
    syncGoogleDocSources().catch((error) => {
      console.error(`Google Docs auto-sync failed: ${error.message}`);
    });
  }, startupDelayMs).unref();

  setInterval(() => {
    syncGoogleDocSources().catch((error) => {
      console.error(`Google Docs auto-sync failed: ${error.message}`);
    });
  }, intervalMs).unref();
}

export async function syncGoogleDocSources() {
  if (syncInProgress) return { skipped: true, reason: "already running" };
  syncInProgress = true;

  try {
    const sources = await loadSources();
    if (sources.length === 0) return { checked: 0, pulled: 0, errors: 0 };

    const state = await loadState();
    const nextState = {
      version: 1,
      lastRunAt: new Date().toISOString(),
      sources: state.sources ?? {}
    };

    let pulled = 0;
    let errors = 0;

    for (const source of sources) {
      const id = source.id;
      const previous = nextState.sources[id] ?? {};
      const checkedAt = new Date().toISOString();

      try {
        const { docId, sourceUrl, text } = await fetchGoogleDocText(source.url);
        const contentHash = hashGoogleDocText(text);
        const rawExists = await fileExists(path.join(config.vaultRoot, "raw", source.filename));
        const changed = previous.contentHash !== contentHash || !rawExists;

        const entry = {
          ...previous,
          title: source.title,
          campaign: source.campaign,
          filename: source.filename,
          url: sourceUrl,
          docId,
          contentHash,
          lastCheckedAt: checkedAt,
          status: changed ? "pulled" : "current"
        };

        if (changed) {
          const result = await writeGoogleDocTextToRaw({
            docId,
            sourceUrl,
            text,
            title: source.title,
            filename: source.filename,
            overwrite: true
          });
          await upsertSourceRegistry({ title: result.title, sourceUrl, filename: result.filename });
          pulled += 1;
          entry.lastPulledAt = checkedAt;
          entry.characterCount = result.characterCount;
          console.log(`Pulled updated Google Doc: ${source.title} -> ${result.relativePath}`);
        }

        delete entry.error;
        nextState.sources[id] = entry;
      } catch (error) {
        errors += 1;
        nextState.sources[id] = {
          ...previous,
          title: source.title,
          campaign: source.campaign,
          filename: source.filename,
          url: source.url,
          lastCheckedAt: checkedAt,
          status: "error",
          error: error.message
        };
        console.error(`Google Docs sync error for ${source.title}: ${error.message}`);
      }
    }

    await saveState(nextState);

    let processed = 0;
    if (config.autoProcessRawSources) {
      const processResult = await processPendingRawSources();
      processed = processResult.processed.length;
      for (const item of processResult.processed) {
        console.log(`Processed raw source: ${item.rawFile} -> ${item.page}`);
      }
      for (const item of processResult.skipped) {
        console.log(`Skipped raw source: ${item.rawFile} (${item.reason})`);
      }
    }

    let indexed = false;
    if (processed > 0 && config.autoIndexAfterSourceProcess) {
      await runIndexer();
      indexed = true;
    }

    if (pulled > 0) {
      const pulledCampaigns = [...new Set(
        Object.entries(nextState.sources)
          .filter(([, entry]) => entry.status === "pulled")
          .map(([, entry]) => entry.campaign)
          .filter(Boolean)
      )];
      for (const campaign of pulledCampaigns) {
        console.log(`Running post-ingest connectivity check for ${campaign}…`);
        const { issues, stubsCreated } = await checkCampaignConnectivity(campaign).catch(err => {
          console.error(`Post-ingest check failed for ${campaign}: ${err.message}`);
          return { issues: [], stubsCreated: 0 };
        });
        const critical = issues.filter(i => i.severity === "critical");
        const warnings = issues.filter(i => i.severity !== "critical");
        if (critical.length) console.warn(`  ${campaign}: ${critical.length} critical gap(s) — run npm run check-ingest for details`);
        if (warnings.length) console.log(`  ${campaign}: ${warnings.length} warning(s)`);
        if (stubsCreated) console.log(`  ${campaign}: created ${stubsCreated} stub page(s)`);
        if (!issues.length) console.log(`  ${campaign}: all clear`);
      }
    }

    return { checked: sources.length, pulled, processed, indexed, errors };
  } finally {
    syncInProgress = false;
  }
}

async function loadSources() {
  let raw;
  try {
    raw = await fs.readFile(config.googleDocSourcesPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const parsed = JSON.parse(raw);
  const sources = Array.isArray(parsed) ? parsed : parsed.sources;
  if (!Array.isArray(sources)) return [];

  return sources
    .filter((source) => source && source.enabled !== false)
    .map((source) => ({
      id: String(source.id ?? source.filename ?? source.url ?? "").trim(),
      campaign: String(source.campaign ?? "").trim(),
      title: String(source.title ?? "").trim(),
      url: String(source.url ?? "").trim(),
      filename: String(source.filename ?? "").trim()
    }))
    .filter((source) => source.id && source.title && source.url && source.filename);
}

async function loadState() {
  try {
    return JSON.parse(await fs.readFile(config.googleDocSyncStatePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, sources: {} };
    throw error;
  }
}

async function saveState(state) {
  await fs.mkdir(path.dirname(config.googleDocSyncStatePath), { recursive: true });
  await fs.writeFile(config.googleDocSyncStatePath, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function runIndexer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["src/indexer.mjs"], {
      cwd: config.appRoot,
      stdio: "inherit",
      shell: false
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Indexer exited with code ${code}.`));
    });
  });
}
