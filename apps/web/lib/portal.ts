import fs from "fs";
import path from "path";

export const PORTAL_URLS = {
  knowledgeBase: "http://kb.suwaneegamers.net",
  referenceSite: "https://sites.google.com/view/suwanee-gamers/",
  dndBeyond: "https://www.dndbeyond.com/",
  calendar: "/calendar",
  maps: "/maps-of-myrdae",
};

export interface PortalLink {
  title: string;
  description: string;
  href: string;
  label?: string;
}

function contentPath(filename: string) {
  return path.join(process.cwd(), "../../content", filename);
}

export function getPortalLinks(): PortalLink[] {
  const raw = fs.readFileSync(contentPath("portal-links.json"), "utf-8");
  return JSON.parse(raw) as PortalLink[];
}

// backward-compat
export const primaryPortalLinks: PortalLink[] = getPortalLinks();

export function kbLink(description: string): PortalLink {
  return {
    title: "Suwanee Gamers Knowledge Base",
    description,
    href: PORTAL_URLS.knowledgeBase,
    label: "Open KB",
  };
}

export function calendarLink(description = "Check the live shared schedule."): PortalLink {
  return {
    title: "Shared Calendar",
    description,
    href: PORTAL_URLS.calendar,
    label: "View Calendar",
  };
}
