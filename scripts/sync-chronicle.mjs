// Living Chronicle sync: refreshes each campaign's player-notes source,
// rebuilds its self-contained HTML, and publishes it under content/chronicles.
// Per-session artwork remains in each chronicle's session-images.json.
//
// Conservative: each campaign has an independent minimum-chapter guard. A bad
// export cannot overwrite its last good source or published chronicle, and one
// campaign's failure does not prevent the others from attempting their sync.
//
// Run manually:  node scripts/sync-chronicle.mjs
// Scheduled:     scripts/sync-chronicle.cmd  ("SuwaneeGamers Chronicle Sync")
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const chronicles = [
  {
    id: "heroes-of-emberstran",
    name: "Heroes of Emberstran",
    dir: path.join(root, "chronicle-poc"),
    source: "hoe-chronicle.md",
    output: "emberstran-chronicle.html",
    served: "heroes-of-emberstran.html",
    exportUrl: "https://docs.google.com/document/d/1ENCKlQLCpkjefs8AgZYXn0_89OgUmJx5ssIFMuOKut4/export?format=md",
    isSessionHead: (line) => /^#\s+\*\*\d+\s*\\?-/.test(line),
    minimumChapters: 20,
  },
  {
    id: "souls-of-destiny",
    name: "Souls of Destiny",
    dir: path.join(root, "sod-chronicle-poc"),
    source: "sod-chronicle.md",
    output: "souls-of-destiny-chronicle.html",
    served: "souls-of-destiny.html",
    exportUrl: "https://docs.google.com/document/d/1pKpiVcOl-mjtJMUD4tuTS6A4UZP3w6ISnehpX8LORH8/export?format=txt",
    isSessionHead: (line) => /^\d+\s*[–-]\s*\S/.test(line.trim()),
    minimumChapters: 10,
  },
  {
    id: "bloody-endeavor",
    name: "Bloody Endeavor II",
    dir: path.join(root, "bloody-endeavor-chronicle-poc"),
    source: "bloody-endeavor-chronicle.md",
    output: "bloody-endeavor-chronicle.html",
    served: "bloody-endeavor.html",
    exportUrl: "https://docs.google.com/document/d/1p35JgGjlsAk6Ul8Y3cJC5P6Jdedr3pHSQQ29Y0ljBuc/export?format=txt",
    isSessionHead: (line) => /^\d{1,2}\s*[–-]\s*\S/.test(line.trim().replace(/^\*\s+/, "")),
    countChapters: (lines) => new Set(
      lines.filter((line) => /^\d{1,2}\s*[–-]\s*\S/.test(line.trim().replace(/^\*\s+/, "")))
        .map((line) => line.trim().replace(/^\*\s+/, "").match(/^(\d{1,2})/)?.[1]),
    ).size,
    normalizeSource: (source) => source.split(/\r?\n/).map((line) => line.trimEnd()).join("\n"),
    minimumChapters: 35,
  },
  {
    id: "a-new-adventure",
    name: "A New Adventure",
    dir: path.join(root, "ana-chronicle-poc"),
    source: "a-new-adventure-chronicle.md",
    output: "a-new-adventure-chronicle.html",
    served: "a-new-adventure.html",
    exportUrl: "https://docs.google.com/document/d/1tZbBbjOzgCiUSmUuepCE_qpsuOJpawrAia0nxYHTtjA/export?format=txt",
    isSessionHead: (line) => /^\d+\s*[–-]\s*\S/.test(line.trim()),
    countChapters: (lines) => new Set(
      lines.filter((line) => /^\d+\s*[–-]\s*\S/.test(line.trim()))
        .map((line) => line.trim().match(/^(\d+)/)?.[1]),
    ).size,
    normalizeSource: (source) => source.split(/\r?\n/).map((line) => line.trimEnd()).join("\n"),
    minimumChapters: 30,
  },
  {
    id: "dungeons-iii",
    name: "Dungeons III - kNight Watch",
    dir: path.join(root, "dungeons-iii-chronicle-poc"),
    source: "dungeons-iii-chronicle.md",
    output: "dungeons-iii-chronicle.html",
    served: "dungeons-iii.html",
    exportUrl: "https://docs.google.com/document/d/1115KjT1J7g-jy4kQXBXzp4vHhoOhPyqrNxcTZkEEAHY/export?format=txt",
    isSessionHead: (line) => /^\d+\s*[–-]\s*\S/.test(line.trim()),
    countChapters: (lines) => new Set(
      lines.filter((line) => /^\d+\s*[–-]\s*\S/.test(line.trim()))
        .map((line) => line.trim().match(/^(\d+)/)?.[1]),
    ).size,
    normalizeSource: (source) => source.split(/\r?\n/).map((line) => line.trimEnd()).join("\n"),
    minimumChapters: 15,
  },
];

async function syncChronicle(config) {
  const stamp = new Date().toISOString();
  const sourcePath = path.join(config.dir, config.source);
  const response = await fetch(config.exportUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${config.name}: document export failed HTTP ${response.status} (is the document link-viewable?)`);
  }

  const exportedSource = await response.text();
  const source = config.normalizeSource ? config.normalizeSource(exportedSource) : exportedSource;
  const sourceLines = source.split(/\r?\n/);
  const chapters = config.countChapters
    ? config.countChapters(sourceLines)
    : sourceLines.filter(config.isSessionHead).length;
  if (chapters < config.minimumChapters) {
    throw new Error(
      `${config.name}: export parsed only ${chapters} chapters; refusing to overwrite ${path.relative(root, sourcePath)}. ` +
      "The document format may have changed or the fetch may have reached a login page.",
    );
  }

  const previous = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf-8") : "";
  if (source === previous) {
    console.log(`[${stamp}] ${config.name}: up to date (${chapters} chapters, no changes).`);
    return;
  }

  fs.writeFileSync(sourcePath, source, "utf-8");
  execFileSync(process.execPath, [path.join(config.dir, "build-chronicle.mjs")], { stdio: "inherit" });

  const servedPath = path.join(root, "content", "chronicles", config.served);
  fs.mkdirSync(path.dirname(servedPath), { recursive: true });
  fs.copyFileSync(path.join(config.dir, config.output), servedPath);
  console.log(`[${stamp}] ${config.name}: updated to ${chapters} chapters, rebuilt, and published.`);
}

const failures = [];
const requestedId = process.argv[2];
const selectedChronicles = requestedId
  ? chronicles.filter((config) => config.id === requestedId)
  : chronicles;
if (requestedId && selectedChronicles.length === 0) {
  throw new Error(`Unknown chronicle id: ${requestedId}`);
}

for (const config of selectedChronicles) {
  try {
    await syncChronicle(config);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length) {
  throw new Error(`Chronicle sync completed with ${failures.length} failure(s):\n- ${failures.join("\n- ")}`);
}
