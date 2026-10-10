import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { config } from "./config.mjs";
import { syncSessionPages } from "./session-pages.mjs";

export async function syncRuntimeSessionPages() {
  const require = createRequire(new URL("../../package.json", import.meta.url));
  const Database = require("better-sqlite3");
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const db = new Database(path.join(root, "content", "suwaneegamers.db"), { readonly: true });
  try {
    const names = { "heroes-of-emberstran": "HoE", "souls-of-destiny": "SoD",
      "bloody-endeavor": "Bloody Endeavor", "dungeons-iii": "Dungeons III",
      "the-silent-vanguard": "The Silent Vanguard", "a-new-adventure": "A New Adventure" };
    const campaigns = db.prepare("SELECT id, name FROM campaigns").all()
      .filter((campaign) => names[campaign.id]).map((campaign) => ({ ...campaign,
        vaultCampaign: names[campaign.id], sessions: db.prepare(
          "SELECT title, summary FROM session_summaries WHERE campaign_id = ? ORDER BY sort_order"
        ).all(campaign.id) }));
    const { sources } = JSON.parse(await fs.readFile(config.googleDocSourcesPath, "utf8"));
    return await syncSessionPages({ vaultRoot: config.vaultRoot, dataDir: config.dataDir, sources, campaigns });
  } finally { db.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await syncRuntimeSessionPages(), null, 2));
}
