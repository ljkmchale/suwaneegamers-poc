// Seeds the Advents Guide rating system with the places of interest that appear
// on each city map, so the drawer's "Places" dropdown is populated from the map
// instead of only from businesses members typed in by hand.
//
// Sources (authoritative, live map):
//   - GET /api/world-data  -> world.locations[] : id, name, cityMap. The 33
//     locations that carry a `cityMap: "city-viewer.html?city=<cityId>"` are the
//     ones with their own city map. The location `id` here is exactly what the
//     map iframe posts to the drawer (advents-guide:open), so businesses are
//     keyed by it — even the one case where the id differs from the city id
//     (abbeyofmontrest -> abbey-of-mont-rest).
//   - /js/cities/<cityId>.js : window.CITY_MAPS_REGISTRY[cityId].pins[] : the
//     buildings/shops/landmarks. These are NOT in the API, only the static file.
//
// Each qualifying pin becomes an `advents_guide_subjects` row of kind
// 'business' (created_by NULL = system-synced). Idempotent: INSERT OR IGNORE,
// never deletes, so member-added places and reviews survive re-runs.
//
// Usage:
//   node scripts/sync-advents-guide-places.mjs
//   node scripts/sync-advents-guide-places.mjs --dry-run
//   node scripts/sync-advents-guide-places.mjs --verbose
import vm from "node:vm";
import { getDb } from "./sync-db.mjs";

const BASE = (process.env.MYRDAE_MAP_BASE ?? "https://mapeditor.suwaneegamers.net").replace(/\/$/, "");
const dryRun = process.argv.includes("--dry-run");
const verbose = process.argv.includes("--verbose");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) suwaneegamers-sync";

// Pins that are pure geography or transit, not places a traveller would review.
// Everything else (businesses, temples, landmarks, arenas, keeps, generic POIs,
// unknown/blank types) is kept.
const EXCLUDE_TYPES = new Set([
  "sea", "water", "river", "lake", "ocean", "coast", "bay", "shore",
  "gate", "harbor", "harbour", "dock", "docks", "bridge", "wall", "walls",
  "road", "route", "pass", "ford", "crossing", "border",
  "district", "region", "direction", "overlook",
]);

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
function locationSubjectId(locationId) {
  return `location:${locationId}`;
}
function businessSubjectId(locationId, name) {
  return `business:${locationId}:${slug(name)}`;
}
function cleanName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.text();
}

// Evaluate a trusted city map file (our own map editor asset) in a sandbox with
// a stub `window`, then read back the registry it populated.
function parseCityPins(source, cityId) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  new vm.Script(source, { filename: `${cityId}.js` }).runInContext(sandbox);
  const registry = sandbox.window.CITY_MAPS_REGISTRY ?? {};
  const entry = registry[cityId] ?? Object.values(registry)[0];
  return Array.isArray(entry?.pins) ? entry.pins : [];
}

async function main() {
  const world = JSON.parse(await fetchText(`${BASE}/api/world-data`));
  const locations = world?.world?.locations ?? [];
  const cityLinks = locations
    .filter((loc) => typeof loc.cityMap === "string" && loc.id && loc.name)
    .map((loc) => ({
      locationId: String(loc.id),
      locationName: cleanName(loc.name),
      cityId: (loc.cityMap.match(/city=([^&"']+)/) || [])[1],
    }))
    .filter((link) => link.cityId);

  console.log(`Found ${cityLinks.length} city-linked locations from ${BASE}/api/world-data`);

  const db = getDb();
  const now = new Date().toISOString();
  const upsertLocation = db.prepare(`
    INSERT INTO advents_guide_subjects (id, kind, map_location_id, parent_subject_id, name, created_at, updated_at)
    VALUES (?, 'location', ?, NULL, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name
  `);
  const insertBusiness = db.prepare(`
    INSERT OR IGNORE INTO advents_guide_subjects
      (id, kind, map_location_id, parent_subject_id, name, created_by_user_id, created_at, updated_at)
    VALUES (?, 'business', ?, ?, ?, NULL, ?, ?)
  `);

  let totalPlaces = 0;
  let totalInserted = 0;
  const seedCity = db.transaction((link, places) => {
    upsertLocation.run(locationSubjectId(link.locationId), link.locationId, link.locationName, now, now);
    const parentId = locationSubjectId(link.locationId);
    for (const name of places) {
      const info = insertBusiness.run(businessSubjectId(link.locationId, name), link.locationId, parentId, name, now, now);
      totalInserted += info.changes;
    }
  });

  for (const link of cityLinks) {
    let pins;
    try {
      pins = parseCityPins(await fetchText(`${BASE}/js/cities/${link.cityId}.js`), link.cityId);
    } catch (err) {
      console.warn(`  ! ${link.cityId}: ${err.message}`);
      continue;
    }
    // Keep reviewable places; dedupe by lower(name) to match the DB's unique index.
    const seen = new Set();
    const places = [];
    for (const pin of pins) {
      const name = cleanName(pin?.name);
      const type = String(pin?.type ?? "").trim().toLowerCase();
      if (name.length < 2 || name.length > 100) continue;
      if (EXCLUDE_TYPES.has(type)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      places.push(name);
    }
    totalPlaces += places.length;
    if (verbose) console.log(`  ${link.locationId} (city ${link.cityId}): ${places.length} places`);
    if (!dryRun) seedCity(link, places);
  }

  console.log(`${dryRun ? "[dry-run] would seed" : "Seeded"} ${totalPlaces} places across ${cityLinks.length} locations` +
    (dryRun ? "" : ` (${totalInserted} newly inserted)`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
