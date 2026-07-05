// Automatically turns new player-safe session summaries into campaign journey
// stops and world-impact entries.
//
// Sources:
//   - SQLite campaigns + session_summaries (written by sync-session-notes.ts)
//   - The authoritative World of Myrdae map API
//   - Existing curated journey stops, used as seed history and aliases
//
// Usage:
//   node scripts/sync-campaign-journeys.mjs
//   node scripts/sync-campaign-journeys.mjs --dry-run
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentPath = path.join(root, "content", "campaign-journeys.json");
const dbPath = path.join(root, "content", "suwaneegamers.db");
const mapApi =
  process.env.MYRDAE_MAP_API ??
  "https://mapeditor.suwaneegamers.net/api/world-data";
const dryRun = process.argv.includes("--dry-run");
const verbose = process.argv.includes("--verbose");

const TYPE_RULES = [
  {
    type: "political",
    pattern:
      /\b(alliance|ambassador|audience|council|crown|emperor|king|lord|politic|treaty|throne|war)\b/i,
  },
  {
    type: "rescue",
    pattern: /\b(freed|protected|rescued|saved|survivors?|evacuated|restored)\b/i,
  },
  {
    type: "battle",
    pattern:
      /\b(ambush|attacked|battle|confronted|defeated|destroyed|fought|killed|slain|slew|victorious)\b/i,
  },
  {
    type: "arcane",
    pattern:
      /\b(artifact|curse|fiend|magic|magical|portal|rift|shadowfell|stygia|undermountain|waypoint)\b/i,
  },
  {
    type: "discovery",
    pattern:
      /\b(clue|discovered|evidence|exposed|found|learned|revealed|uncovered)\b/i,
  },
  {
    type: "warning",
    pattern:
      /\b(danger|escaped|loom|missing|mystery|threat|trouble|unknown|warning)\b/i,
  },
];

const IMPACT_TITLES = {
  arcane: (location) => `Arcane consequences at ${location}`,
  battle: (location) => `Conflict reshaped ${location}`,
  discovery: () => "A new truth surfaced",
  political: (location) => `${location}'s balance shifted`,
  rescue: (location) => `Lives changed at ${location}`,
  warning: (location) => `Danger remains at ${location}`,
};

const OFF_MAP_NAMES = [
  "Stygia",
  "Shadowfell",
  "Undermountain",
  "Featherfall campsite",
  "Iohir Monastery",
  "Nunglthil",
  "Thallgrove",
  "Bimblefol",
  "Bloomrest",
  "Blackstone Crucible",
  "The Long Night",
];

const MAP_LOCATION_ALIASES = {
  abbeyofmontrest: ["Abbey of Light", "Abbey"],
};

const RETIRED_LOCATION_HINT_IDS = new Set([
  // Basctdelm was a future lead, not a place A New Adventure visited.
  "hint-ana-basctdelm",
]);

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9']/g, "");
}

function displayName(value) {
  return String(value ?? "")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sessionNumber(title) {
  const match = String(title).match(/(?:session\s*)?(\d+)/i);
  return match ? Number(match[1]) : null;
}

function sessionLabel(title) {
  return String(title)
    .replace(/^session\s+\d+\s*[-–—:]\s*/i, "")
    .replace(/\\!/g, "!")
    .trim();
}

function hashSource(campaignId, title, summary) {
  return crypto
    .createHash("sha256")
    .update(`${campaignId}\n${title}\n${summary}`)
    .digest("hex");
}

function cleanText(value, maxLength = 720) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\\([!#])/g, "$1")
    .trim();
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength);
  const sentenceEnd = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf("!"),
    clipped.lastIndexOf("?"),
  );
  return `${clipped.slice(0, sentenceEnd > maxLength * 0.55 ? sentenceEnd + 1 : maxLength).trim()}…`;
}

function sentences(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function impactFor(summary, location) {
  const fullText = String(summary ?? "");
  let selectedRule = TYPE_RULES.find((rule) => rule.pattern.test(fullText));
  if (!selectedRule) selectedRule = TYPE_RULES[TYPE_RULES.length - 1];

  const candidates = sentences(fullText);
  let best = candidates[0] ?? fullText;
  let bestScore = -1;
  for (const sentence of candidates) {
    let score = 0;
    for (const rule of TYPE_RULES) {
      if (rule.pattern.test(sentence)) score += rule.type === selectedRule.type ? 5 : 1;
    }
    if (
      /\b(defeated|destroyed|discovered|escaped|exposed|freed|learned|prevented|protected|recovered|rescued|returned|saved|uncovered)\b/i.test(
        sentence,
      )
    ) {
      score += 5;
    }
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }

  return {
    type: selectedRule.type,
    title: IMPACT_TITLES[selectedRule.type](location),
    description: cleanText(best, 300),
  };
}

function locationCandidatesFromWorld(world) {
  const ambiguousNames = new Set([
    "waypoint",
    "unnamedlocation",
    "unknownlocation",
    "crossroads",
  ]);
  const rows = [
    ...(Array.isArray(world?.locations) ? world.locations : []),
    ...(Array.isArray(world?.underdark?.locations)
      ? world.underdark.locations
      : []),
  ];
  return rows
    .filter(
      (row) =>
        row &&
        typeof row.name === "string" &&
        !ambiguousNames.has(normalizeName(row.name)) &&
        Number.isFinite(Number(row.x)) &&
        Number.isFinite(Number(row.y)),
    )
    .map((row) => {
      const locationId = row.id ? String(row.id) : undefined;
      const aliases = locationId ? MAP_LOCATION_ALIASES[locationId] : undefined;
      return {
        locationId,
        location: aliases?.[0] ?? displayName(row.name),
        ...(aliases ? { matchNames: aliases } : {}),
        x: Number(row.x),
        y: Number(row.y),
        realm: row.realm_id ?? row.realm ?? "surface",
        precision: undefined,
        origin: "map",
      };
    });
}

function locationCandidatesFromSeeds(document) {
  return document.campaigns.flatMap((campaign) =>
    [
      ...(Array.isArray(campaign.locationHints) ? campaign.locationHints : []),
      ...campaign.stops.filter((stop) => !stop.sourceKey),
    ]
      .filter(
        (stop) =>
          Number.isFinite(Number(stop.x)) && Number.isFinite(Number(stop.y)),
      )
      .map((stop) => ({
        locationId: stop.locationId,
        location: stop.location,
        x: Number(stop.x),
        y: Number(stop.y),
        realm: stop.realm ?? "surface",
        precision: stop.precision,
        origin: "seed",
      })),
  );
}

function dedupeLocations(rows) {
  const byName = new Map();
  for (const row of rows) {
    const key = normalizeName(row.location);
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing || (row.origin === "map" && existing.origin !== "map")) {
      byName.set(key, row);
    }
  }
  return [...byName.values()];
}

function roadPoint(rawPoint, locationsById) {
  if (typeof rawPoint === "string") {
    const location = locationsById.get(rawPoint);
    return location
      ? { x: Number(location.x), y: Number(location.y), locationId: rawPoint }
      : null;
  }
  if (
    Array.isArray(rawPoint) &&
    rawPoint.length === 2 &&
    Number.isFinite(Number(rawPoint[0])) &&
    Number.isFinite(Number(rawPoint[1]))
  ) {
    return { x: Number(rawPoint[0]), y: Number(rawPoint[1]), locationId: null };
  }
  if (
    rawPoint &&
    Number.isFinite(Number(rawPoint.x)) &&
    Number.isFinite(Number(rawPoint.y))
  ) {
    return {
      x: Number(rawPoint.x),
      y: Number(rawPoint.y),
      locationId: rawPoint.locationId ?? null,
    };
  }
  return null;
}

function pathDistance(points) {
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    distance += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }
  return distance;
}

function addGraphEdge(graph, fromId, toId, road, points, mode) {
  if (!fromId || !toId || fromId === toId || points.length < 2) return;
  const distance = pathDistance(points);
  const edge = {
    fromId,
    toId,
    roadId: road.id ?? "",
    roadName: displayName(road.name ?? ""),
    roadType: road.type ?? mode,
    mode,
    distance,
    points,
  };
  const forward = graph.get(fromId) ?? [];
  forward.push(edge);
  graph.set(fromId, forward);

  const reverse = graph.get(toId) ?? [];
  reverse.push({
    ...edge,
    fromId: toId,
    toId: fromId,
    points: [...points].reverse(),
  });
  graph.set(toId, reverse);
}

function buildTravelGraph(world, mode) {
  const locations = [
    ...(Array.isArray(world?.locations) ? world.locations : []),
    ...(Array.isArray(world?.underdark?.locations)
      ? world.underdark.locations
      : []),
  ];
  const locationsById = new Map(
    locations.filter((location) => location?.id).map((location) => [location.id, location]),
  );
  const roads = [
    ...(Array.isArray(world?.roads) ? world.roads : []),
    ...(Array.isArray(world?.underdark?.roads) ? world.underdark.roads : []),
  ].filter((road) =>
    mode === "water"
      ? road.type === "water-route"
      : road.type !== "water-route",
  );
  const graph = new Map();

  for (const road of roads) {
    const rawPoints = Array.isArray(road.points)
      ? road.points
      : Array.isArray(road.waypoints)
        ? road.waypoints
        : [];
    let lastNamed = null;
    let segment = [];
    for (const rawPoint of rawPoints) {
      const point = roadPoint(rawPoint, locationsById);
      if (!point) continue;
      segment.push(point);
      if (!point.locationId) continue;
      if (
        lastNamed &&
        lastNamed.locationId !== point.locationId &&
        segment.length >= 2
      ) {
        addGraphEdge(
          graph,
          lastNamed.locationId,
          point.locationId,
          road,
          segment,
          mode,
        );
      }
      lastNamed = point;
      segment = [point];
    }
  }
  return graph;
}

function findTravelRoute(fromId, toId, graph) {
  if (!fromId || !toId || fromId === toId) return null;
  const distances = new Map([[fromId, 0]]);
  const previous = new Map();
  const visited = new Set();

  while (true) {
    let current = null;
    let currentDistance = Infinity;
    for (const [locationId, distance] of distances) {
      if (!visited.has(locationId) && distance < currentDistance) {
        current = locationId;
        currentDistance = distance;
      }
    }
    if (!current || current === toId) break;
    visited.add(current);
    for (const edge of graph.get(current) ?? []) {
      const nextDistance = currentDistance + edge.distance;
      if (nextDistance < (distances.get(edge.toId) ?? Infinity)) {
        distances.set(edge.toId, nextDistance);
        previous.set(edge.toId, { fromId: current, edge });
      }
    }
  }
  if (!distances.has(toId)) return null;

  const edges = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const entry = previous.get(cursor);
    if (!entry) return null;
    edges.unshift(entry.edge);
    cursor = entry.fromId;
  }
  const points = [];
  for (const edge of edges) {
    for (const point of edge.points) {
      const previousPoint = points[points.length - 1];
      if (
        !previousPoint ||
        previousPoint.x !== point.x ||
        previousPoint.y !== point.y
      ) {
        points.push({ x: point.x, y: point.y });
      }
    }
  }
  return {
    points,
    distance: distances.get(toId),
    roadIds: [...new Set(edges.map((edge) => edge.roadId).filter(Boolean))],
    roadNames: [
      ...new Set(edges.map((edge) => edge.roadName).filter(Boolean)),
    ],
  };
}

function directDistance(from, to) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function buildRoute(previous, current, summary, graphs) {
  if (!previous) return undefined;
  const directPoints = [
    { x: previous.x, y: previous.y },
    { x: current.x, y: current.y },
  ];
  if (
    previous.x === current.x &&
    previous.y === current.y &&
    normalizeName(previous.location) === normalizeName(current.location)
  ) {
    return { mode: "local", points: [] };
  }
  if (current.precision === "off-map" || previous.precision === "off-map") {
    return {
      mode:
        /\b(portal|teleport|waypoint|rift|plane|shadowfell|stygia)\b/i.test(summary)
          ? "portal"
          : "off-map",
      points: directPoints,
    };
  }
  if (
    previous.realm &&
    current.realm &&
    previous.realm !== current.realm
  ) {
    return { mode: "realm-transition", points: directPoints };
  }

  const wantsWater =
    /\b(boat|docks?|harbor|river|sail|sea|ship|vessel|voyage)\b/i.test(summary);
  const graphChoices = wantsWater
    ? [
        ["water", graphs.water],
        ["road", graphs.road],
      ]
    : [["road", graphs.road]];

  for (const [mode, graph] of graphChoices) {
    const found = findTravelRoute(
      previous.locationId,
      current.locationId,
      graph,
    );
    if (!found) continue;
    const direct = Math.max(0.01, directDistance(previous, current));
    if (found.distance > direct * 2.75) continue;
    const miles = found.distance * 25;
    const milesPerDay = mode === "water" ? 72 : 20;
    return {
      mode,
      points: found.points,
      miles: Number(miles.toFixed(1)),
      days: Number((miles / milesPerDay).toFixed(1)),
      roadIds: found.roadIds,
      roadNames: found.roadNames,
    };
  }
  return {
    mode: "direct",
    points: directPoints,
    miles: Number((directDistance(previous, current) * 25).toFixed(1)),
  };
}

function scoreLocationName(candidate, name, text, title, previous) {
  if (name.length < 3) return 0;
  const escaped = escapeRegExp(name)
    .replace(/['’]/g, "['’]")
    .replace(/\s+/g, "\\s+");
  const narrativeText = text.slice(title.length + 2);
  const cleanTitle = sessionLabel(title);
  if (
    new RegExp(`^to\\s+(?:the\\s+)?${escaped}\\b`, "i").test(cleanTitle) &&
    !new RegExp(`(^|[^A-Za-z])${escaped}(?=$|[^A-Za-z])`, "i").test(
      narrativeText,
    )
  ) {
    return 0;
  }
  const occurrencePattern = new RegExp(`(^|[^A-Za-z])${escaped}(?=$|[^A-Za-z])`, "gi");
  const occurrences = [...text.matchAll(occurrencePattern)];
  if (occurrences.length === 0) return 0;

  let score = occurrences.length * 10;
  const movementPattern = new RegExp(
    `\\b(arrived|began|continued|entered|gathered|headed|lingered|pressed|pulled|reached|remained|returned|returning|standing|stood|traveled|travelled|went)\\b.{0,100}\\b${escaped}\\b`,
    "i",
  );
  if (movementPattern.test(text)) score += 35;
  if (new RegExp(`\\b(in|at|beneath|below|inside|near|outside|through|toward|to)\\s+(?:the\\s+)?${escaped}\\b`, "i").test(text)) {
    score += 18;
  }
  if (
    new RegExp(
      `\\b(crossed|pulled|stepped|teleported|transported)\\b.{0,120}\\b(into|through|to)\\b.{0,70}\\b${escaped}\\b`,
      "i",
    ).test(text)
  ) {
    score += 80;
  }
  if (text.slice(0, 220).toLowerCase().includes(name.toLowerCase())) score += 20;
  const finalSentence = sentences(text).at(-1) ?? "";
  if (finalSentence.toLowerCase().includes(name.toLowerCase())) score += 50;
  if (
    new RegExp(
      `\\b(ended|ending|escaped|returned|returning|reached)\\b.{0,65}\\b${escaped}\\b`,
      "i",
    ).test(finalSentence)
  ) {
    score += 45;
  }
  if (title.toLowerCase().includes(name.toLowerCase())) score += 25;
  if (
    new RegExp(
      `\\b(plans?|planned|preparing)\\b.{0,45}\\b(head|headed|travel|traveled|go|went)\\b.{0,30}\\b(to|toward)\\s+(?:the\\s+)?${escaped}\\b`,
      "i",
    ).test(text)
  ) {
    score -= 90;
  }
  if (
    new RegExp(
      `\\bescort(?:ed|ing)?\\b.{0,100}\\bto\\s+(?:the\\s+)?${escaped}\\b`,
      "i",
    ).test(text) &&
    !new RegExp(
      `\\b(arrived|entered|reached|returned)\\b.{0,80}\\b${escaped}\\b`,
      "i",
    ).test(text)
  ) {
    score -= 80;
  }
  if (
    new RegExp(
      `\\b(?:clues?|evidence)\\b.{0,80}\\b(?:point(?:ed|ing)?|tie|tied|tying)\\b.{0,40}\\b(?:to|back\\s+to)\\s+(?:the\\s+)?${escaped}\\b`,
      "i",
    ).test(text)
  ) {
    score -= 70;
  }
  if (
    previous &&
    normalizeName(previous.location) === normalizeName(candidate.location)
  ) {
    score += 4;
  }
  return score;
}

function scoreLocation(candidate, text, title, previous) {
  const names = [
    displayName(candidate.location),
    ...(Array.isArray(candidate.matchNames) ? candidate.matchNames : []),
  ];
  return Math.max(
    ...[...new Set(names)]
      .filter(Boolean)
      .map((name) => scoreLocationName(candidate, name, text, title, previous)),
  );
}

function offMapCandidates(text, previous) {
  if (!previous) return [];
  const names = new Set();
  for (const name of OFF_MAP_NAMES) {
    if (new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text)) names.add(name);
  }

  const placePatterns = [
    /\b(?:arrived|gathered|reached|returned|returning|standing)\s+(?:in|at|beneath|below|inside|near|outside|through|to)?\s*(?:the\s+)?([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,3}\s+(?:building|campsite|monastery|temple))\b/g,
    /\b(?:into|through|to)\s+(?:the\s+)?(?:frozen\s+(?:wastes|hellscape)\s+of\s+)?(Stygia|Shadowfell|Undermountain|Iohir Monastery)\b/gi,
  ];
  for (const pattern of placePatterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) names.add(displayName(match[1]));
    }
  }

  return [...names].map((location) => ({
    location,
    x: previous.x,
    y: previous.y,
    realm: previous.realm ?? "surface",
    precision: "off-map",
    origin: "off-map",
  }));
}

function resolveLocation(summary, title, previous, locations, hint) {
  const text = `${title}. ${summary}`;
  let best = null;
  let bestScore = 0;

  const candidates = [...locations, ...offMapCandidates(text, previous)];
  const scored = [];
  for (const candidate of candidates) {
    const score = scoreLocation(candidate, text, title, previous);
    if (score > 0) scored.push({ location: candidate.location, score, origin: candidate.origin });
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  if (verbose) {
    console.log(
      `[resolve] ${title}: ${scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((item) => `${item.location}=${item.score} (${item.origin})`)
        .join(", ")}`,
    );
  }

  if (hint && (!best || bestScore < 100)) {
    return {
      ...hint,
      realm: hint.realm ?? "surface",
      confidence: hint.precision === "off-map" ? 0.72 : 0.86,
      automatic: true,
    };
  }

  if (best && bestScore >= 10) {
    const confidence = Math.min(1, 0.62 + bestScore / 130);
    return {
      ...best,
      confidence:
        best.precision === "off-map" ? Math.min(0.79, confidence) : confidence,
      automatic: true,
    };
  }

  if (!previous) return null;
  return {
    ...(previous.locationId ? { locationId: previous.locationId } : {}),
    location: previous.location,
    x: previous.x,
    y: previous.y,
    realm: previous.realm ?? "surface",
    ...(previous.precision ? { precision: previous.precision } : {}),
    confidence: 0.68,
    automatic: true,
  };
}

async function fetchWorld() {
  try {
    const response = await fetch(mapApi, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const world = payload?.world ?? payload;
    if (!world || !Array.isArray(world.locations)) {
      throw new Error("Response did not contain world locations");
    }
    return { world, source: mapApi };
  } catch (error) {
    console.warn(
      `Map API unavailable (${error instanceof Error ? error.message : String(error)}); using cached map database.`,
    );
    const rawPath = path.join(
      root,
      "apps",
      "web",
      "brain-vault",
      "raw",
      "worldofmyrdae-map-database.md",
    );
    const markdown = fs.readFileSync(rawPath, "utf8");
    const locations = [];
    for (const line of markdown.split(/\r?\n/)) {
      const match = line.match(
        /^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*\|/,
      );
      if (!match) continue;
      locations.push({
        id: match[1].trim(),
        name: match[2].trim(),
        type: match[3].trim(),
        region: match[4].trim() || null,
        biome: match[5].trim() || null,
        x: Number(match[6]),
        y: Number(match[7]),
      });
    }
    return { world: { locations, underdark: { locations: [] } }, source: rawPath };
  }
}

function readJourneyDocument(db) {
  const row = db
    .prepare(`SELECT json FROM content_documents WHERE path = ?`)
    .get("campaign-journeys.json");
  if (row?.json) return JSON.parse(row.json);
  return JSON.parse(fs.readFileSync(contentPath, "utf8"));
}

function makeLocationHints(campaign) {
  if (Array.isArray(campaign.locationHints) && campaign.locationHints.length > 0) {
    return campaign.locationHints.filter(
      (hint) => !RETIRED_LOCATION_HINT_IDS.has(hint.id),
    );
  }
  return campaign.stops
    .filter((stop) => !stop.sourceKey)
    .map((stop) => ({
      id: `hint-${stop.id}`,
      ...(stop.locationId ? { locationId: stop.locationId } : {}),
      location: stop.location,
      x: stop.x,
      y: stop.y,
      ...(stop.realm ? { realm: stop.realm } : {}),
      ...(stop.precision ? { precision: stop.precision } : {}),
      session: stop.session,
    }));
}

function hintCoversSession(hint, number) {
  const values = [...String(hint.session ?? "").matchAll(/\d+/g)].map((match) =>
    Number(match[0]),
  );
  if (values.length === 0) return false;
  if (values.length === 1) return values[0] === number;
  return number >= Math.min(...values) && number <= Math.max(...values);
}

function hintForSession(hints, number) {
  return hints.filter((hint) => hintCoversSession(hint, number)).at(-1) ?? null;
}

function buildGeneratedStop(
  campaign,
  row,
  previous,
  locations,
  hint,
  graphs,
) {
  const number = sessionNumber(row.title);
  if (number === null) return null;
  const location = resolveLocation(
    row.summary,
    row.title,
    previous,
    locations,
    hint,
  );
  if (!location) return null;
  const sourceKey = `${campaign.id}:session-${number}`;
  const route = buildRoute(previous, location, row.summary, graphs);

  return {
    id: `auto-${campaign.id}-session-${number}`,
    ...(location.locationId ? { locationId: location.locationId } : {}),
    location: location.location,
    x: location.x,
    y: location.y,
    ...(location.realm && location.realm !== "surface"
      ? { realm: location.realm }
      : {}),
    ...(location.precision ? { precision: location.precision } : {}),
    session: `Session ${number}`,
    realDate: row.session_date ?? undefined,
    title: sessionLabel(row.title),
    summary: cleanText(row.summary),
    impact: impactFor(row.summary, location.location),
    automatic: true,
    confidence: Number(location.confidence.toFixed(2)),
    ...(route ? { route } : {}),
    sourceKey,
    sourceHash: hashSource(campaign.id, row.title, row.summary),
  };
}

function buildLocationImpactHistory(campaigns) {
  const groups = new Map();
  for (const campaign of campaigns) {
    for (const stop of campaign.stops) {
      if (!stop.impact) continue;
      const key = stop.locationId
        ? `${stop.realm ?? "surface"}:${stop.locationId}`
        : `name:${normalizeName(stop.location)}`;
      const group = groups.get(key) ?? {
        id: key.replace(/[^a-z0-9-]+/gi, "-"),
        ...(stop.locationId ? { locationId: stop.locationId } : {}),
        location: stop.location,
        x: stop.x,
        y: stop.y,
        realm: stop.realm ?? "surface",
        campaignIds: [],
        impacts: [],
      };
      if (!group.campaignIds.includes(campaign.id)) {
        group.campaignIds.push(campaign.id);
      }
      group.impacts.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        session: stop.session,
        title: stop.impact.title,
        type: stop.impact.type,
        description: stop.impact.description,
      });
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      crossCampaign: group.campaignIds.length > 1,
    }))
    .sort(
      (left, right) =>
        Number(right.crossCampaign) - Number(left.crossCampaign) ||
        right.impacts.length - left.impacts.length ||
        left.location.localeCompare(right.location),
    );
}

function updateDocument(document, db, locations, graphs) {
  const campaignRows = db
    .prepare(`SELECT id, name FROM campaigns`)
    .all();
  const campaignNames = new Map(campaignRows.map((row) => [row.id, row.name]));
  const sessionsForCampaign = db.prepare(`
    SELECT title, summary, session_date, sort_order
    FROM session_summaries
    WHERE campaign_id = ?
    ORDER BY sort_order DESC
  `);

  let generatedCount = 0;
  let changedCampaigns = 0;
  const summaries = [];

  for (const campaign of document.campaigns) {
    const locationHints = makeLocationHints(campaign);
    campaign.locationHints = locationHints;
    const rows = sessionsForCampaign.all(campaign.id);
    const generated = [];
    let previous = null;

    for (const row of rows) {
      const number = sessionNumber(row.title);
      if (number === null) continue;
      const stop = buildGeneratedStop(
        campaign,
        row,
        previous,
        locations,
        hintForSession(locationHints, number),
        graphs,
      );
      if (!stop) continue;
      generated.push(stop);
      previous = stop;
    }

    const oldGenerated = campaign.stops
      .filter((stop) => stop.sourceKey)
      .map(({ current: _current, ...stop }) => stop);
    if (JSON.stringify(oldGenerated) !== JSON.stringify(generated)) {
      changedCampaigns += 1;
    }

    campaign.stops = generated.map((stop) => ({
      ...stop,
      current: false,
    }));
    const latest = campaign.stops[campaign.stops.length - 1];
    if (latest) {
      latest.current = true;
      campaign.status =
        latest.precision === "off-map"
          ? `${latest.location} · beyond the mapped world`
          : `At ${latest.location}`;
    } else if (campaignNames.has(campaign.id)) {
      campaign.status = campaign.status || "Awaiting a mapped session";
    }

    generatedCount += generated.length;
    summaries.push({
      campaignId: campaign.id,
      generatedSessions: generated.map((stop) => stop.session),
      generatedLocations: generated.map((stop) => stop.location),
      latestLocation: latest?.location ?? null,
    });
  }

  document.locationImpacts = buildLocationImpactHistory(document.campaigns);
  const routedSegments = document.campaigns.reduce(
    (total, campaign) =>
      total +
      campaign.stops.filter(
        (stop) => stop.route?.mode === "road" || stop.route?.mode === "water",
      ).length,
    0,
  );
  document.sync = {
    mode: "automatic",
    lastGeneratedAt: new Date().toISOString(),
    sessionSource: "content/suwaneegamers.db#session_summaries",
    mapSource: mapApi,
    generatedStops: generatedCount,
    routedSegments,
    impactLocations: document.locationImpacts.length,
  };

  return { document, changedCampaigns, generatedCount, summaries };
}

function writeJourneyDocument(db, document) {
  const json = `${JSON.stringify(document, null, 2)}\n`;
  const current = fs.existsSync(contentPath)
    ? fs.readFileSync(contentPath, "utf8")
    : "";
  if (current !== json) {
    fs.writeFileSync(contentPath, json, "utf8");
  }
  db.prepare(`
    INSERT INTO content_documents (path, json, updated_at, source)
    VALUES (?, ?, ?, 'campaign-journey-sync')
    ON CONFLICT(path) DO UPDATE SET
      json = excluded.json,
      updated_at = excluded.updated_at,
      source = excluded.source
  `).run("campaign-journeys.json", json, new Date().toISOString());
}

async function main() {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  const document = readJourneyDocument(db);
  const { world, source } = await fetchWorld();
  const locations = dedupeLocations([
    ...locationCandidatesFromWorld(world),
    ...locationCandidatesFromSeeds(document),
  ]);
  const graphs = {
    road: buildTravelGraph(world, "road"),
    water: buildTravelGraph(world, "water"),
  };
  const result = updateDocument(document, db, locations, graphs);

  console.log(
    `Resolved ${locations.length} map locations and ${graphs.road.size + graphs.water.size} routed nodes from ${source}.`,
  );
  for (const summary of result.summaries) {
    if (summary.generatedSessions.length === 0) continue;
    console.log(
      `✓ ${summary.campaignId}: ${summary.generatedSessions
        .map((session, index) => `${session} → ${summary.generatedLocations[index]}`)
        .join(", ")}`,
    );
  }
  console.log(
    `Generated ${result.generatedCount} automatic stop(s) across ${result.changedCampaigns} changed campaign(s).`,
  );

  if (dryRun) {
    console.log("Dry run complete; no files or database rows were changed.");
    return;
  }
  writeJourneyDocument(db, result.document);
  console.log("Campaign journeys JSON and SQLite content document updated.");
}

main().catch((error) => {
  console.error(
    `Campaign journey sync failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
