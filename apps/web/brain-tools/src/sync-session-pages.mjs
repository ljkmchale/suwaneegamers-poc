import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { config } from "./config.mjs";
import { getDb } from "../../../../scripts/sync-db.mjs";
import { syncSessionPages } from "./session-pages.mjs";

export async function syncRuntimeSessionPages() {
  const db = getDb();
  {
    const names = { "might-of-dragons": "Might of Dragons", "heroes-of-emberstran": "HoE", "souls-of-destiny": "SoD",
      "bloody-endeavor": "Bloody Endeavor", "dungeons-iii": "Dungeons III",
      "the-silent-vanguard": "The Silent Vanguard", "a-new-adventure": "A New Adventure" };
    const campaigns = db.prepare("SELECT id, name FROM campaigns").all()
      .filter((campaign) => names[campaign.id]).map((campaign) => ({ ...campaign,
        vaultCampaign: names[campaign.id], sessions: db.prepare(
          "SELECT title, summary FROM session_summaries WHERE campaign_id = ? ORDER BY sort_order"
        ).all(campaign.id) }));
    const { sources } = JSON.parse(await fs.readFile(config.googleDocSourcesPath, "utf8"));
    return await syncSessionPages({ vaultRoot: config.vaultRoot, dataDir: config.dataDir, sources, campaigns });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await syncRuntimeSessionPages(), null, 2));
}
