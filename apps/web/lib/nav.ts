import { readContent, writeContent } from "@/lib/contentFiles";

export interface NavItem {
  id: string;
  href: string;
  label: string;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export interface NavConfig {
  sections: NavSection[];
}

const DEFAULT_CONFIG: NavConfig = {
  sections: [
    {
      id: "primary",
      label: "Primary Navigation",
      items: [
        { id: "campaigns", href: "/campaigns", label: "Campaigns" },
        { id: "campaign-journeys", href: "/campaign-journeys", label: "Journeys" },
        { id: "advents-of-harmony", href: "/advents_of_harmony", label: "Library" },
        { id: "dungeon-masters", href: "/dungeon-masters", label: "DMs" },
        { id: "players", href: "/players", label: "Players" },
      ],
    },
    {
      id: "world",
      label: "Myrdae Dropdown",
      items: [
        { id: "map-viewer", href: "https://mapeditor.suwaneegamers.net/embed-map.html", label: "Map Viewer" },
        { id: "bestiary", href: "/bestiary", label: "Bestiary" },
        { id: "setting", href: "/setting", label: "Setting" },
        { id: "territories", href: "/territories", label: "Territories" },
        { id: "pantheon", href: "/pantheon", label: "Pantheon" },
        { id: "history", href: "/history", label: "History" },
        { id: "lore", href: "/lore", label: "Legends & Lore" },
        { id: "gazetteer", href: "/gazetteer", label: "Gazetteer" },
        { id: "maps-of-myrdae", href: "/maps-of-myrdae", label: "Maps of Myrdae" },
      ],
    },
    {
      id: "tools",
      label: "Toolset",
      items: [
        { id: "campaign-setting", href: "/campaign-setting", label: "Campaign Setting" },
        { id: "reference-for-dungeon-masters", href: "/reference-for-dungeon-masters", label: "DM Reference" },
        { id: "gazetteer", href: "/gazetteer", label: "Gazetteer" },
        { id: "bestiary", href: "/bestiary", label: "Bestiary" },
        { id: "lore", href: "/lore", label: "Legends & Lore" },
        { id: "territories", href: "/territories", label: "Territories" },
        { id: "previous-campaigns", href: "/previous-campaigns", label: "Previous Campaigns" },
      ],
    },
  ],
};

export function getNavConfig(): NavConfig {
  try {
    return readContent<NavConfig>("nav.json");
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function writeNavConfig(config: NavConfig): void {
  writeContent("nav.json", config);
}

/** Convenience: pull a section's items by id */
export function getNavSection(config: NavConfig, sectionId: string): NavItem[] {
  return config.sections.find((s) => s.id === sectionId)?.items ?? [];
}
