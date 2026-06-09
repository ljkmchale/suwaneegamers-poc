import fs from "fs";
import { contentPath } from "@/lib/contentFiles";

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
        { id: "calendar", href: "/calendar", label: "Calendar" },
        { id: "campaigns", href: "/campaigns", label: "Campaigns" },
        { id: "chronicles", href: "https://kb.suwaneegamers.net/", label: "Chronicles" },
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

function navPath() {
  return contentPath("nav.json");
}

export function getNavConfig(): NavConfig {
  try {
    return JSON.parse(fs.readFileSync(navPath(), "utf-8")) as NavConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function writeNavConfig(config: NavConfig): void {
  fs.writeFileSync(navPath(), JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/** Convenience: pull a section's items by id */
export function getNavSection(config: NavConfig, sectionId: string): NavItem[] {
  return config.sections.find((s) => s.id === sectionId)?.items ?? [];
}
