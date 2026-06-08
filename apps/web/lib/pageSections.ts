/**
 * Static section metadata for each editable page.
 * No fs calls — safe to import in client components.
 */

export interface SectionMeta {
  id: string;
  label: string;
  description: string;
}

export const PAGE_SECTIONS: Record<string, SectionMeta[]> = {
  // ── Built-in pages (mix of sections + blocks) ────────────────────────────────
  "/": [
    { id: "hero",   label: "Hero Banner",  description: "Full-width hero with title and tagline" },
    { id: "portal", label: "Portal Links", description: "Quick-access portal link cards" },
  ],
  "/campaigns": [
    { id: "campaigns",      label: "Active Campaigns",     description: "Campaign cards grid" },
    { id: "side-campaigns", label: "Other Campaign Tools", description: "Side / alternate campaign cards" },
  ],
  "/players": [
    { id: "players",    label: "Player Profiles",       description: "Player cards with characters" },
    { id: "unassigned", label: "Unassigned Characters", description: "Characters that still need a player" },
  ],
  "/dungeon-masters": [
    { id: "dms", label: "DM Profiles", description: "Dungeon Master cards" },
  ],
  "/bestiary": [
    { id: "creatures", label: "Creature Gallery", description: "Creature portrait cards" },
  ],
  // ── Block-only pages (no built-in sections) ───────────────────────────────────
  "/lore":               [],
  "/world":              [],
  "/setting":            [],
  "/history":            [],
  "/pantheon":           [],
  "/gazetteer":          [],
  "/campaign-setting":   [],
  "/organizations":      [],
  "/reference-for-dungeon-masters": [],
  "/territories":        [],
  "/maps-of-myrdae":     [],
  "/previous-campaigns": [],
  "/test-page":          [],
};
