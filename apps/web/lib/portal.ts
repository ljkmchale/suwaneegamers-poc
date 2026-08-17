import { readContent } from "@/lib/contentFiles";

export const PORTAL_URLS = {
  chronicles: "/advents_of_harmony",
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

export function getPortalLinks(): PortalLink[] {
  return readContent<PortalLink[]>("portal-links.json");
}


export function chroniclesLink(description: string): PortalLink {
  return {
    title: "Advents of Harmony",
    description,
    href: PORTAL_URLS.chronicles,
    label: "Enter the Library",
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
