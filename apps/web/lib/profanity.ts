/**
 * Lightweight profanity gate for member-submitted text (Advents Guide reviews).
 * Pure and client-safe — no fs, no server imports — so the same check runs in
 * the browser (instant feedback) and on the server (authoritative).
 *
 * Deliberately conservative: only strong profanity and slurs, NOT mild words
 * like "hell"/"damn"/"crap" which are everyday D&D lore ("the Nine Hells").
 * Matching is whole-word after light de-leet/de-stretch normalization, so it
 * avoids the Scunthorpe problem (e.g. "class", "assassin", "shiitake" pass).
 */

// Base stems; each is matched as a whole word with common suffixes.
const PROFANITY_STEMS = [
  "fuck", "shit", "bitch", "bastard", "asshole", "dickhead", "prick",
  "cunt", "cock", "pussy", "slut", "whore", "twat", "wank", "bollock",
  "nigger", "nigga", "faggot", "fag", "retard", "spastic", "chink", "kike",
  "spic", "wetback", "tranny", "coon", "dyke", "goddamn", "motherfucker",
];

// Whole-word, allowing common inflections (fucks, fucking, bitches, …).
const PROFANITY_RE = new RegExp(
  `\\b(?:${PROFANITY_STEMS.join("|")})(?:s|es|es|ing|in|ed|er|ers|y|ies|hole|holes)?\\b`,
  "i",
);

function normalizeForProfanity(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0]/g, "o").replace(/[1|]/g, "i").replace(/[3]/g, "e")
    .replace(/[4@]/g, "a").replace(/[5$]/g, "s").replace(/[7]/g, "t")
    // collapse stretched letters: "shiiit" -> "shit"
    .replace(/(.)\1{2,}/g, "$1");
}

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  return PROFANITY_RE.test(normalizeForProfanity(text));
}
