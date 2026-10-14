// Pure helpers for the Chronicle art queue (scripts/chronicle-art.mjs): split
// each campaign's player-notes export into chapters, decide whether a chapter
// is real, finished notes, and verify that a proposed scene is actually quoted
// from them. No I/O beyond reading the note files, so it is unit-tested.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// The per-campaign data mirrors scripts/sync-chronicle.mjs (same note files,
// same served HTML) plus the Codex skill that owns each campaign's art rules.
export const CAMPAIGNS = [
  { id: "heroes-of-emberstran", name: "Heroes of Emberstran", dir: "chronicle-poc",
    source: "hoe-chronicle.md", output: "emberstran-chronicle.html", served: "heroes-of-emberstran.html",
    skill: "hoe-chronicle-scenes" },
  { id: "souls-of-destiny", name: "Souls of Destiny", dir: "sod-chronicle-poc",
    source: "sod-chronicle.md", output: "souls-of-destiny-chronicle.html", served: "souls-of-destiny.html",
    skill: "sod-chronicle-scenes" },
  { id: "bloody-endeavor", name: "Bloody Endeavor II", dir: "bloody-endeavor-chronicle-poc",
    source: "bloody-endeavor-chronicle.md", output: "bloody-endeavor-chronicle.html", served: "bloody-endeavor.html",
    skill: "bloody-endeavor-chronicle-scenes" },
  { id: "a-new-adventure", name: "A New Adventure", dir: "ana-chronicle-poc",
    source: "a-new-adventure-chronicle.md", output: "a-new-adventure-chronicle.html", served: "a-new-adventure.html",
    skill: "a-new-adventure-chronicle-scenes" },
  { id: "dungeons-iii", name: "Dungeons III - kNight Watch", dir: "dungeons-iii-chronicle-poc",
    source: "dungeons-iii-chronicle.md", output: "dungeons-iii-chronicle.html", served: "dungeons-iii.html",
    skill: "dungeons-iii-chronicle-scenes" },
];

// Real notes need a body this long; the shortest finished session on record is
// ~960 words, and headings/templates/stub lines are far below this.
export const MIN_WORDS = 400;
export const MIN_LINES = 5;

/** "# **36 \- Title**", "\t44 - Title", "* 6 – no, 5 – Guys" -> {number,title} or null. */
export function parseHeading(line) {
  const cleaned = String(line)
    .replace(/^[\s#*]+/, "")
    .replace(/\*\*/g, "")
    .replace(/\\/g, "")
    .trim();
  const match = /^(\d{1,3})\s*[–—-]\s*(\S.*)$/.exec(cleaned);
  if (!match) return null;
  return { number: Number(match[1]), title: match[2].trim() };
}

/**
 * Split a notes export into chapters. A heading only counts if its number is
 * higher than the last accepted chapter (and not a wild jump), which discards
 * list items like "6 – no, 5 – Guys" inside a session body.
 */
export function parseChapters(text) {
  const lines = String(text).split(/\r?\n/);
  const heads = [];
  let last = 0;
  lines.forEach((line, index) => {
    const head = parseHeading(line);
    if (!head) return;
    if (head.number <= last || head.number > last + 5) return;
    last = head.number;
    heads.push({ ...head, index });
  });
  return heads.map((head, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : lines.length;
    const body = lines.slice(head.index + 1, end).join("\n").trim();
    return {
      number: head.number,
      key: String(head.number).padStart(2, "0"),
      title: head.title,
      body,
      words: body.split(/\s+/).filter(Boolean).length,
      lines: body.split("\n").filter((l) => l.trim()).length,
      hash: crypto.createHash("sha256").update(body).digest("hex").slice(0, 16),
    };
  });
}

/** Is this chapter finished, substantive notes rather than a heading or template? */
export function assessNotes(chapter) {
  if (chapter.words < MIN_WORDS) {
    return { real: false, reason: `only ${chapter.words} words (needs ${MIN_WORDS})` };
  }
  if (chapter.lines < MIN_LINES) {
    return { real: false, reason: `only ${chapter.lines} lines of notes (needs ${MIN_LINES})` };
  }
  return { real: true, reason: `${chapter.words} words` };
}

export function readChapters(root, campaign) {
  const file = path.join(root, campaign.dir, campaign.source);
  return parseChapters(fs.readFileSync(file, "utf8"));
}

/** Highest chapter that already has art in the campaign's session-images.json. */
export function highestImaged(root, campaign) {
  const file = path.join(root, campaign.dir, "session-images.json");
  let map = {};
  try {
    map = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // no map yet
  }
  const keys = Object.entries(map)
    .filter(([, url]) => typeof url === "string" && url)
    .map(([key]) => Number(key))
    .filter(Number.isFinite);
  return keys.length ? Math.max(...keys) : 0;
}

/**
 * Fold typography the Windows shell mangles when Codex reads the notes (curly
 * quotes become "ƒ?o") to plain ASCII. The same fold is applied to the file
 * Codex reads and to the notes it is checked against, so quotes still match.
 */
export function asciiFold(text) {
  return String(text)
    .replace(/[‘’‚‛`´]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/Æ/g, "AE")
    .replace(/æ/g, "ae")
    .replace(/ /g, " ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x00-\x7f]/g, "?");
}

function normalise(text) {
  return asciiFold(text)
    .toLowerCase()
    .replace(/[*_]/g, "")
    .split(String.fromCharCode(92))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The scene brief must be anchored in the notes: every evidence quote has to
 * appear verbatim (modulo markup/quote style) in the chapter, and every named
 * participant has to be mentioned there. Returns a list of problems.
 */
export function verifyBrief(brief, chapterBody) {
  const problems = [];
  const haystack = normalise(chapterBody);
  const quotes = Array.isArray(brief?.evidence) ? brief.evidence : [];
  if (quotes.length < 2) problems.push("needs at least two verbatim evidence quotes");
  quotes.forEach((quote, i) => {
    const needle = normalise(quote);
    if (needle.split(" ").length < 6) problems.push(`evidence ${i + 1} is shorter than six words`);
    else if (!haystack.includes(needle)) problems.push(`evidence ${i + 1} is not in the notes: "${String(quote).slice(0, 80)}"`);
  });
  const people = Array.isArray(brief?.participants) ? brief.participants : [];
  if (people.length < 1) problems.push("no participants listed");
  let named = 0;
  for (const person of people) {
    // The notes often use a nickname ("Affy") where the skill uses the full name.
    const tokens = normalise(person?.name ?? "")
      .split(/[^a-z0-9']+/)
      .filter((token) => token.length >= 3);
    // A name with no readable token (the shell turns "AEon" into "A+on") cannot
    // be checked, so it is skipped; the verbatim quotes still anchor the scene.
    if (!tokens.length) continue;
    named += 1;
    if (!tokens.some((token) => haystack.includes(token))) {
      problems.push(`participant "${person.name}" is never mentioned in the notes`);
    }
  }
  if (people.length && named === 0) problems.push("no participant has a checkable name");
  for (const field of ["moment", "action", "location"]) {
    if (!String(brief?.[field] ?? "").trim()) problems.push(`brief is missing ${field}`);
  }
  return problems;
}

export function slugify(text, fallback = "scene") {
  const slug = String(text ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-");
  return slug || fallback;
}
