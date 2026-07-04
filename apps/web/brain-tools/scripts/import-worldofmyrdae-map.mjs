import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { config } from "../src/config.mjs";
import { markRawSourceProcessed } from "../src/processed-sources.mjs";

const vaultRoot = config.vaultRoot;
const worldRepoRoot = process.env.WORLDOFMYRDAE_REPO_ROOT
  ? path.resolve(process.env.WORLDOFMYRDAE_REPO_ROOT)
  : path.resolve(vaultRoot, "..", "..", "WorldofMyrdae");
const locationsDbPath = path.join(worldRepoRoot, "js", "locations-db.js");

const rawFilename = "worldofmyrdae-map-database.md";
const rawPath = path.join(vaultRoot, "raw", rawFilename);
const summaryPath = path.join(vaultRoot, "wiki", "summaries", "WorldofMyrdae Map Database.md");
const worldLocationsDir = path.join(vaultRoot, "wiki", "world", "locations");
const mapIndexPath = path.join(vaultRoot, "wiki", "world", "World Map Location Index.md");
const rootIndexPath = path.join(vaultRoot, "index.md");
const logPath = path.join(vaultRoot, "log.md");
const sourcesPath = path.join(vaultRoot, "raw", "_sources.md");

const generatedStart = "<!-- WORLD_MAP_METADATA_START -->";
const generatedEnd = "<!-- WORLD_MAP_METADATA_END -->";
const generatedFileNote = "<!-- Generated from WorldofMyrdae map database. Preserve prose edits outside generated metadata blocks. -->";

const existingAliasById = new Map([
  ["abbeyofmontrest", "Abbey of Light"],
]);

const data = await loadWorldLocations();
const locationById = new Map(data.locations.map((location) => [location.id, location]));
const routeLinks = buildRouteLinks(data.roads, locationById);
const pageByLocation = await resolvePageTargets(data.locations);
const stats = buildStats(data.locations, data.roads);

await fs.mkdir(path.dirname(rawPath), { recursive: true });
await fs.mkdir(worldLocationsDir, { recursive: true });
await fs.mkdir(path.dirname(summaryPath), { recursive: true });

await fs.writeFile(rawPath, renderRawSnapshot(data, stats, routeLinks), "utf8");
await fs.writeFile(summaryPath, renderSummary(stats), "utf8");
await fs.writeFile(mapIndexPath, renderMapIndex(data, stats, pageByLocation, routeLinks), "utf8");

const updatedPages = new Set([
  "wiki/summaries/WorldofMyrdae Map Database.md",
  "wiki/world/World Map Location Index.md",
]);

let created = 0;
let updated = 0;

for (const location of data.locations) {
  const targetPath = pageByLocation.get(location.id);
  const existed = await fileExists(targetPath);
  const nextContent = existed
    ? await updateExistingLocationPage(targetPath, location, routeLinks, pageByLocation)
    : renderLocationStub(location, routeLinks, pageByLocation);

  await fs.writeFile(targetPath, nextContent, "utf8");
  if (existed) updated += 1;
  else created += 1;

  updatedPages.add(toVaultPath(targetPath));
}

await ensureSourcesEntry(stats);
await ensureRootIndexEntry();
await appendLogEntry(stats, created, updated);

updatedPages.add("raw/_sources.md");
updatedPages.add("index.md");
updatedPages.add("log.md");

const receipt = await markRawSourceProcessed({
  filename: rawFilename,
  pages: [...updatedPages].sort(),
  notes: `Imported ${data.locations.length} map locations and ${data.roads.length} routes from WorldofMyrdae locations-db.js.`
});

console.log(JSON.stringify({
  rawFile: receipt.rawFile,
  created,
  updated,
  locations: data.locations.length,
  roads: data.roads.length,
  regions: stats.regions.length,
  receipt: `processed/${path.basename(rawFilename, ".md")}.json`
}, null, 2));

async function loadWorldLocations() {
  const source = await fs.readFile(locationsDbPath, "utf8");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.WORLD_LOCATIONS = WORLD_LOCATIONS;`, sandbox, {
    filename: locationsDbPath
  });

  const worldLocations = sandbox.WORLD_LOCATIONS;
  if (!worldLocations || !Array.isArray(worldLocations.locations)) {
    throw new Error("Could not load WORLD_LOCATIONS.locations from locations-db.js");
  }

  return {
    locations: worldLocations.locations.map(normalizeLocation).sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name))),
    roads: Array.isArray(worldLocations.roads) ? worldLocations.roads : [],
    regions: Array.isArray(worldLocations.regions) ? worldLocations.regions : []
  };
}

function normalizeLocation(location) {
  return {
    ...location,
    name: cleanName(location.name),
    type: String(location.type ?? "").trim(),
    region: cleanName(location.region ?? ""),
    description: cleanDescription(location.description ?? ""),
    biome: cleanName(location.biome ?? "")
  };
}

function cleanName(value) {
  return String(value ?? "").replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
}

function cleanDescription(value) {
  return cleanName(value).replace(/\|/g, "\\|");
}

function buildRouteLinks(roads, locationById) {
  const links = new Map();
  for (const locationId of locationById.keys()) links.set(locationId, []);

  for (const road of roads) {
    const endpoints = (road.points ?? []).filter((point) => typeof point === "string");
    if (endpoints.length < 2) continue;
    const from = endpoints[0];
    const to = endpoints[endpoints.length - 1];
    if (!locationById.has(from) || !locationById.has(to)) continue;

    links.get(from).push({ id: road.id, type: road.type ?? "route", to });
    links.get(to).push({ id: road.id, type: road.type ?? "route", to: from });
  }

  for (const entries of links.values()) {
    entries.sort((a, b) => a.to.localeCompare(b.to));
  }
  return links;
}

async function resolvePageTargets(locations) {
  const pageByCleanTitle = new Map();
  const existingFiles = await listMarkdownFiles(worldLocationsDir);

  for (const filePath of existingFiles) {
    const basename = path.basename(filePath, ".md");
    pageByCleanTitle.set(normalizeKey(basename), filePath);

    const text = await fs.readFile(filePath, "utf8");
    const title = text.match(/^#\s+(.+)$/m)?.[1];
    if (title) pageByCleanTitle.set(normalizeKey(title), filePath);
  }

  const usedPaths = new Set();
  const pageTargets = new Map();
  for (const location of locations) {
    const alias = existingAliasById.get(location.id);
    const target = alias
      ? pageByCleanTitle.get(normalizeKey(alias))
      : pageByCleanTitle.get(normalizeKey(location.name));

    let filePath = target ?? path.join(worldLocationsDir, `${safeFilename(location.name)}.md`);
    filePath = dedupePath(filePath, location.id, usedPaths);
    usedPaths.add(filePath);
    pageTargets.set(location.id, filePath);
  }

  return pageTargets;
}

function dedupePath(filePath, locationId, usedPaths) {
  if (!usedPaths.has(filePath)) return filePath;
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);
  return `${base} - ${locationId}${ext}`;
}

async function listMarkdownFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => path.join(dir, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safeFilename(value) {
  const cleaned = cleanName(value)
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "Unnamed Location";
}

function renderLocationStub(location, routeLinks, pageByLocation) {
  return [
    generatedFileNote,
    `# ${location.name}`,
    "",
    "## Scope",
    "",
    "World lore - canonical geography of [[Myrdae]]. Campaign party experiences belong in campaign-specific location pages.",
    "",
    "## Overview",
    "",
    `${location.name} is a ${typeLabel(location.type)}${location.region ? ` in [[Territories of Myrdae|${location.region}]]` : " on the Myrdae world map"}.${hasUsefulDescription(location) ? ` ${location.description}` : " This page is a world stub generated from the WorldofMyrdae map database and needs prose expansion from a dedicated source."}`,
    "",
    renderGeneratedBlock(location, routeLinks, pageByLocation),
    "",
    "## Source Anchors",
    "",
    "- Raw source: `raw/worldofmyrdae-map-database.md`",
    "- [[WorldofMyrdae Map Database]]",
    "- [[World Map Location Index]]",
    ""
  ].join("\n");
}

async function updateExistingLocationPage(filePath, location, routeLinks, pageByLocation) {
  const existing = await fs.readFile(filePath, "utf8");
  if (existing.startsWith(generatedFileNote)) {
    return renderLocationStub(location, routeLinks, pageByLocation);
  }
  const block = renderGeneratedBlock(location, routeLinks, pageByLocation);
  const withBlock = replaceOrInsertGeneratedBlock(existing, block);
  return ensureSourceAnchors(withBlock);
}

function replaceOrInsertGeneratedBlock(content, block) {
  const pattern = new RegExp(`${escapeRegExp(generatedStart)}[\\s\\S]*?${escapeRegExp(generatedEnd)}`);
  if (pattern.test(content)) {
    return content.replace(pattern, block);
  }

  const sourceHeading = content.match(/\n## Source Anchors\n/);
  if (sourceHeading) {
    const index = sourceHeading.index;
    return `${content.slice(0, index).trimEnd()}\n\n${block}\n${content.slice(index)}`;
  }

  return `${content.trimEnd()}\n\n${block}\n`;
}

function ensureSourceAnchors(content) {
  if (content.includes("[[WorldofMyrdae Map Database]]")) return content;
  if (content.includes("## Source Anchors")) {
    return content.replace(/(## Source Anchors\s*\n)/, `$1\n- Raw source: \`raw/worldofmyrdae-map-database.md\`\n- [[WorldofMyrdae Map Database]]\n- [[World Map Location Index]]\n`);
  }
  return `${content.trimEnd()}\n\n## Source Anchors\n\n- Raw source: \`raw/worldofmyrdae-map-database.md\`\n- [[WorldofMyrdae Map Database]]\n- [[World Map Location Index]]\n`;
}

function renderGeneratedBlock(location, routeLinks, pageByLocation) {
  const routes = routeLinks.get(location.id) ?? [];
  const routeRows = routes.length
    ? routes.map((route) => {
      const target = locationById.get(route.to);
      return `| [[${pageTitleFor(route.to, pageByLocation)}|${target?.name ?? route.to}]] | ${route.type} | \`${route.id}\` |`;
    }).join("\n")
    : "| None recorded |  |  |";

  return [
    generatedStart,
    "## Map Metadata",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Map id | \`${location.id}\` |`,
    `| Type | ${typeLabel(location.type)} |`,
    `| Region | ${location.region ? `[[Territories of Myrdae|${location.region}]]` : "Unknown / not tagged"} |`,
    `| Biome | ${location.biome || "Not tagged"} |`,
    `| Coordinates | ${formatNumber(location.x)}, ${formatNumber(location.y)} |`,
    `| City map | ${location.cityMap ? `\`${location.cityMap}\`` : "None recorded"} |`,
    `| Gazetteer link | ${location.link ? `[Google Doc](${location.link})` : "None recorded"} |`,
    "",
    "## Route Connections",
    "",
    "| Connected Location | Route Type | Route Id |",
    "|---|---|---|",
    routeRows,
    generatedEnd
  ].join("\n");
}

function pageTitleFor(locationId, pageByLocation) {
  const filePath = pageByLocation.get(locationId);
  return filePath ? path.basename(filePath, ".md") : locationById.get(locationId)?.name ?? locationId;
}

function typeLabel(value) {
  return String(value ?? "location").replace(/-/g, " ") || "location";
}

function hasUsefulDescription(location) {
  const description = normalizeKey(location.description);
  if (!description) return false;
  const generic = new Set([
    normalizeKey(location.type),
    normalizeKey(typeLabel(location.type)),
    "city",
    "town",
    "small city",
    "capital",
    "point of interest",
    "nature",
    "water",
    "river",
    "region",
    "landmark",
    "ruins"
  ]);
  return !generic.has(description);
}

function formatNumber(value) {
  return typeof value === "number" ? Number(value.toFixed(2)).toString() : "";
}

function renderRawSnapshot(data, stats, routeLinks) {
  const locationRows = data.locations.map((location) => {
    const routes = (routeLinks.get(location.id) ?? []).map((route) => route.to).join(", ");
    return `| \`${location.id}\` | ${location.name} | ${typeLabel(location.type)} | ${location.region || ""} | ${location.biome || ""} | ${formatNumber(location.x)}, ${formatNumber(location.y)} | ${routes} |`;
  }).join("\n");

  const roadRows = data.roads.map((road) => {
    const endpoints = (road.points ?? []).filter((point) => typeof point === "string").join(" -> ");
    return `| \`${road.id}\` | ${road.type ?? ""} | ${endpoints} |`;
  }).join("\n");

  return [
    "# WorldofMyrdae Map Database",
    "",
    "Immutable source snapshot generated from `C:\\Users\\Larry McHale\\Desktop\\WorldofMyrdae\\js\\locations-db.js`.",
    "",
    "This source captures the map editor's canonical location, coordinate, type, region, city-map, Gazetteer-link, and route metadata. Prose world canon should still live in `wiki/world/`; this source is the structured map layer.",
    "",
    "## Snapshot Stats",
    "",
    `- Locations: ${data.locations.length}`,
    `- Roads/routes: ${data.roads.length}`,
    `- Tagged regions: ${stats.regions.length}`,
    `- Location types: ${stats.types.join(", ")}`,
    "",
    "## Locations",
    "",
    "| Map id | Name | Type | Region | Biome | Coordinates | Direct route ids |",
    "|---|---|---|---|---|---|---|",
    locationRows,
    "",
    "## Roads",
    "",
    "| Route id | Type | Endpoints |",
    "|---|---|---|",
    roadRows,
    ""
  ].join("\n");
}

function renderSummary(stats) {
  return [
    "---",
    "campaign: World",
    "---",
    "",
    "# WorldofMyrdae Map Database",
    "",
    "## Scope",
    "",
    "World-source summary for `raw/worldofmyrdae-map-database.md`. This is structured map metadata from the WorldofMyrdae map editor, not campaign event prose.",
    "",
    "## Summary",
    "",
    `The WorldofMyrdae map database contributes the continent map's structured geography layer: ${stats.locationCount} locations, ${stats.roadCount} roads/routes, ${stats.regions.length} tagged regions, location types, map coordinates, optional city-map links, optional Gazetteer links, biome tags, and route connectivity.`,
    "",
    "The campaign brain uses this source to maintain map metadata on `wiki/world/locations/` pages and to generate stubs for map locations that do not yet have dedicated prose pages. Rich Gazetteer or campaign-derived prose remains on the existing world or campaign pages; generated map metadata is additive.",
    "",
    "## Key Extracted Pages",
    "",
    "- [[World Map Location Index]] - navigable index of map locations by region and type.",
    "- `wiki/world/locations/` - individual world location pages and generated stubs.",
    "",
    "## Source Notes",
    "",
    "- Source path: `C:\\Users\\Larry McHale\\Desktop\\WorldofMyrdae\\js\\locations-db.js`.",
    "- Active map image context includes `C:\\Users\\Larry McHale\\Desktop\\WorldofMyrdae\\images\\Myrdae_locations.jpg` and `images/map-layers/Myrdae-layered-preview.jpg`.",
    "- Generated metadata blocks are bounded by `WORLD_MAP_METADATA_START` / `WORLD_MAP_METADATA_END` comments so future imports can refresh map data without replacing prose.",
    ""
  ].join("\n");
}

function renderMapIndex(data, stats, pageByLocation, routeLinks) {
  const byRegion = new Map();
  for (const location of data.locations) {
    const region = location.region || "Untagged / Map Labels";
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region).push(location);
  }

  const regionSections = [...byRegion.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([region, locations]) => {
    const rows = locations
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((location) => `| [[${pageTitleFor(location.id, pageByLocation)}|${location.name}]] | \`${location.id}\` | ${typeLabel(location.type)} | ${location.biome || ""} | ${formatNumber(location.x)}, ${formatNumber(location.y)} | ${(routeLinks.get(location.id) ?? []).length} |`)
      .join("\n");

    return [
      `## ${region}`,
      "",
      "| Location | Map id | Type | Biome | Coordinates | Direct Routes |",
      "|---|---|---|---|---|---|",
      rows,
      ""
    ].join("\n");
  }).join("\n");

  return [
    "# World Map Location Index",
    "",
    "## Scope",
    "",
    "Campaign-agnostic map index for Myrdae, generated from the WorldofMyrdae map editor database. This page is for finding places, coordinates, and route connectivity; richer lore belongs on each world location page.",
    "",
    "## Snapshot",
    "",
    `- Locations: ${data.locations.length}`,
    `- Roads/routes: ${data.roads.length}`,
    `- Tagged regions: ${stats.regions.length}`,
    `- Location types: ${stats.types.join(", ")}`,
    "- Source: `raw/worldofmyrdae-map-database.md`",
    "",
    regionSections,
    "## Source Anchors",
    "",
    "- Raw source: `raw/worldofmyrdae-map-database.md`",
    "- [[WorldofMyrdae Map Database]]",
    "- [[Myrdae]]",
    "- [[Territories of Myrdae]]",
    ""
  ].join("\n");
}

function buildStats(locations, roads) {
  return {
    locationCount: locations.length,
    roadCount: roads.length,
    types: [...new Set(locations.map((location) => location.type).filter(Boolean))].sort(),
    regions: [...new Set(locations.map((location) => location.region).filter(Boolean))].sort()
  };
}

async function ensureSourcesEntry(stats) {
  const entry = "- `worldofmyrdae-map-database.md` - structured map editor export from WorldofMyrdae with locations, coordinates, types, regions, and routes.";
  await ensureLineInFile(sourcesPath, entry, "# Raw Sources\n\n");
}

async function ensureRootIndexEntry() {
  let content = await fs.readFile(rootIndexPath, "utf8");
  content = insertAfterLine(content, "- [[Myths and Tales of Myrdae]] - shared myths, divine origin tales, artifacts, and old hero stories.", "- [[World Map Location Index]] - generated map index for Myrdae locations, coordinates, regions, types, and route connectivity.");
  content = insertAfterLine(content, "- [[O'naren Gazetteer]] - source summary for O'naren's elven foothill settlement gazetteer, government, Fralee worship, economy, map, and notable locations.", "- [[WorldofMyrdae Map Database]] - source summary for the WorldofMyrdae map editor's structured location, coordinate, route, and map-link database.");
  await fs.writeFile(rootIndexPath, content, "utf8");
}

async function appendLogEntry(stats, created, updated) {
  const content = await fs.readFile(logPath, "utf8");
  const header = "## [2026-05-13] ingest | Imported WorldofMyrdae map database";
  if (content.includes(header)) return;

  const entry = [
    "",
    header,
    "",
    `- Generated \`raw/worldofmyrdae-map-database.md\` from \`WorldofMyrdae/js/locations-db.js\` with ${stats.locationCount} locations and ${stats.roadCount} roads/routes.`,
    `- Added \`wiki/world/World Map Location Index.md\` and refreshed generated map metadata on world location pages (${created} created, ${updated} updated).`,
    "- Preserved existing Gazetteer/world prose by updating only bounded generated metadata blocks on existing pages.",
    "- Added the map database summary and index entries so the query app can retrieve map coordinates, regions, types, city-map links, Gazetteer links, and direct route connectivity.",
    ""
  ].join("\n");

  await fs.writeFile(logPath, `${content.trimEnd()}\n${entry}`, "utf8");
}

async function ensureLineInFile(filePath, line, fallback = "") {
  let content = fallback;
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (content.includes(line)) return;
  await fs.writeFile(filePath, `${content.trimEnd()}\n${line}\n`, "utf8");
}

function insertAfterLine(content, anchor, line) {
  if (content.includes(line)) return content;
  const index = content.indexOf(anchor);
  if (index === -1) return `${content.trimEnd()}\n${line}\n`;
  const insertAt = index + anchor.length;
  return `${content.slice(0, insertAt)}\n${line}${content.slice(insertAt)}`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toVaultPath(filePath) {
  return path.relative(vaultRoot, filePath).replaceAll(path.sep, "/");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
