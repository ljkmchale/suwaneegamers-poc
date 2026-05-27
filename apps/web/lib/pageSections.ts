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
  "/": [
    { id: "hero",   label: "Hero Banner",            description: "Full-width hero with title and tagline" },
    { id: "portal", label: "Portal Links & Founders", description: "Quick-access cards and founder profiles" },
  ],
  "/campaigns": [
    { id: "header",          label: "Page Header",          description: "Title and description" },
    { id: "campaigns",       label: "Active Campaigns",     description: "Campaign cards grid" },
    { id: "side-campaigns",  label: "Other Campaign Tools", description: "Side / alternate campaign cards" },
  ],
  "/players": [
    { id: "header",     label: "Page Header",            description: "Title and description" },
    { id: "players",    label: "Player Profiles",        description: "Player cards with characters" },
    { id: "unassigned", label: "Unassigned Characters",  description: "Characters that still need a player" },
  ],
  "/dungeon-masters": [
    { id: "header", label: "Page Header", description: "Title, description, and reference links" },
    { id: "dms",    label: "DM Profiles", description: "Dungeon Master cards" },
  ],
  "/bestiary": [
    { id: "header",    label: "Page Header",     description: "Title and description" },
    { id: "creatures", label: "Creature Gallery", description: "Creature portrait cards" },
  ],
};
