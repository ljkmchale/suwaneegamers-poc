// Types and pure helpers for the synced campaign character roster.
// No fs calls — imported by client components. File reads live in
// lib/campaignRosterData.ts (server-only).

/** One character row synced from the "PC Info" roster spreadsheet. */
export interface RosterCharacter {
  character: string;
  player?: string;
  species?: string;
  class?: string;
  subclass?: string;
  level?: number;
  status?: string;
  deathDate?: string;
  notes?: string;
}

export interface CampaignRosterEntry {
  name: string;
  kind: "active" | "archived";
  sheetName: string;
  characters: RosterCharacter[];
}

export interface CampaignRosterFile {
  sourceUrl: string;
  syncedAt: string;
  campaigns: Record<string, CampaignRosterEntry>;
  unmatched: Record<string, RosterCharacter[]>;
}

function normalizeCharacterName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Find the roster row for a curated party-member name. Curated names are often
 * short ("Fungus") while the sheet has the full name ("Teldo \"Fungus Roundbelly\""),
 * so fall back to containment when there is no exact match.
 */
export function findRosterCharacter(
  characters: RosterCharacter[],
  name: string
): RosterCharacter | undefined {
  const normalized = normalizeCharacterName(name);
  if (!normalized) return undefined;

  return (
    characters.find((c) => normalizeCharacterName(c.character) === normalized) ??
    characters.find((c) => {
      const full = normalizeCharacterName(c.character);
      const padded = ` ${full} `;
      return padded.includes(` ${normalized} `) || normalized.includes(full);
    })
  );
}

/** Compact one-line descriptor, e.g. "Half-Orc Paladin (Oath of Sacrifice) · Lv 16". */
export function rosterDescriptor(c: RosterCharacter): string {
  const build = [c.species, c.class].filter(Boolean).join(" ");
  const parts: string[] = [];
  if (build) parts.push(c.subclass ? `${build} (${c.subclass})` : build);
  else if (c.subclass) parts.push(c.subclass);
  if (typeof c.level === "number") parts.push(`Lv ${c.level}`);
  return parts.join(" · ");
}

/** Status label including the death date when the character died. */
export function rosterStatusLabel(c: RosterCharacter): string | undefined {
  if (!c.status) return undefined;
  if (c.status.toLowerCase() === "deceased" && c.deathDate) {
    return `Deceased ${c.deathDate}`;
  }
  return c.status;
}

export function isDeceased(c: RosterCharacter): boolean {
  return c.status?.toLowerCase() === "deceased";
}
