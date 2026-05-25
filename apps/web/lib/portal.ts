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

export const primaryPortalLinks: PortalLink[] = [
  {
    title: "Knowledge Base",
    description: "Canonical Myrdae lore, campaign notes, world reference, and table knowledge.",
    href: PORTAL_URLS.knowledgeBase,
    label: "Open KB",
  },
  {
    title: "Calendar",
    description: "Live shared Google Calendar for upcoming sessions and table events.",
    href: PORTAL_URLS.calendar,
    label: "View Calendar",
  },
  {
    title: "D&D Beyond",
    description: "Campaign tools, character sheets, rules, and player resources.",
    href: PORTAL_URLS.dndBeyond,
    label: "Open D&D Beyond",
  },
  {
    title: "Original Google Site",
    description: "The legacy Suwanee Gamers site this portal is modeled after.",
    href: PORTAL_URLS.referenceSite,
    label: "Open Reference",
  },
];

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
