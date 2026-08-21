// Chronicle sync: pulls the HOE session-notes Google Doc (markdown export),
// refreshes chronicle-poc/hoe-chronicle.md, and rebuilds the self-contained
// emberstran-chronicle.html. Per-session images (session-images.json) are
// re-injected by the builder, so artwork survives every sync.
//
// Conservative: if the fetched export does not parse into a sensible number
// of chapters, the local copy is LEFT UNTOUCHED and the run reports an error,
// so a bad/redirected fetch can never blank the page.
//
// Run manually:  node scripts/sync-chronicle.mjs
// Scheduled:     scripts/sync-chronicle.cmd  ("SuwaneeGamers Chronicle Sync" task)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POC = path.join(root, "chronicle-poc");
const MD = path.join(POC, "hoe-chronicle.md");

// HOE "Session Notes" Google Doc. Must stay link-viewable for the headless
// export fetch to work without auth.
const DOC_ID = "1ENCKlQLCpkjefs8AgZYXn0_89OgUmJx5ssIFMuOKut4";
const EXPORT_URL = `https://docs.google.com/document/d/${DOC_ID}/export?format=md`;

// Session headers appear as "# **01 - Title**" (Drive) or "# **01 \\- Title**" (md export).
const isSessionHead = (l) => /^#\s+\*\*\d+\s*\\?-/.test(l);
const stamp = new Date().toISOString();

const res = await fetch(EXPORT_URL, { redirect: "follow" });
if (!res.ok) throw new Error(`[${stamp}] Chronicle sync: doc export failed HTTP ${res.status} (is the doc link-viewable?)`);
const md = await res.text();

const chapters = md.split("\n").filter(isSessionHead).length;
if (chapters < 20) {
  throw new Error(
    `[${stamp}] Chronicle sync: export parsed only ${chapters} chapters — refusing to overwrite ${path.relative(root, MD)}. ` +
    `The doc format may have changed or the fetch was redirected to a login page.`,
  );
}

const prev = fs.existsSync(MD) ? fs.readFileSync(MD, "utf-8") : "";
if (md === prev) {
  console.log(`[${stamp}] Chronicle sync: up to date (${chapters} chapters, no changes).`);
  process.exit(0);
}

fs.writeFileSync(MD, md, "utf-8");

// Rebuild the self-contained page (re-injects images from session-images.json).
execFileSync(process.execPath, [path.join(POC, "build-chronicle.mjs")], { stdio: "inherit" });

// Publish the built page to the location the site route serves (read at request
// time, so this reflects live without a rebuild). content/ is prod-safe.
const served = path.join(root, "content", "chronicles", "heroes-of-emberstran.html");
fs.mkdirSync(path.dirname(served), { recursive: true });
fs.copyFileSync(path.join(POC, "emberstran-chronicle.html"), served);

console.log(`[${stamp}] Chronicle sync: updated to ${chapters} chapters, rebuilt, and published to the site route.`);
