import { readContent, writeContent } from "@/lib/contentFiles";

export type WarcraftPlayer = { name: string; character: string; className: string; level: string; image?: string };
export type WarcraftNight = { id: string; date: string; title: string; notes: string };
export type WarcraftGroup = { id: string; name: string; discordUrl: string; members: Record<string, string>; players: WarcraftPlayer[]; nights: WarcraftNight[] };
export type WarcraftHub = { groups?: WarcraftGroup[]; schedule: string; nextNight: string; realm: string; faction: string; objective: string; players: WarcraftPlayer[]; nights: WarcraftNight[] };

const initial: WarcraftHub = {
  schedule: "About once a week · day and time to be decided",
  nextNight: "First game night to be decided",
  realm: "To be decided", faction: "To be decided",
  objective: "Choose our realm and faction, create our characters, and begin the adventure together.",
  players: [
    { name: "Chip", character: "", className: "Paladin (tentative)", level: "" },
    { name: "Lesley", character: "", className: "Druid (tentative)", level: "" },
    { name: "Sean", character: "", className: "Undecided", level: "" },
    { name: "Larry", character: "", className: "Mage", level: "" },
    { name: "Emma", character: "", className: "Hunter or Rogue", level: "" },
    { name: "Ty", character: "", className: "Undecided", level: "" },
  ],
  nights: [],
};

export function getWarcraftHub(): WarcraftHub {
  try { return readContent<WarcraftHub>("wow-forever.json"); }
  catch { return structuredClone(initial); }
}
export function saveWarcraftHub(hub: WarcraftHub) { writeContent("wow-forever.json", hub); }

export const warcraftGroupAMembers: Record<string, string> = {
  "390a0a45aadcfeb14b33989c": "Larry", "b2f082fa8ccad583d3523435": "Chip",
  "84a012426ea6409e052ac880": "Lesley", "c71df713027bb52bfb23ac72": "Sean",
  "a4ac974e235cb8705e5e2824": "Emma", "3ef235a3385aca5bfff5f0e5": "Ty",
};

// Upgrade the single-party document in memory; persist through the normal DB/file writer.
export function warcraftGroups(hub: WarcraftHub): WarcraftGroup[] {
  return hub.groups ?? [{ id: "group-a", name: "Group A", discordUrl: "https://discord.com/channels/319954674188943362/325247957932834816", members: { ...warcraftGroupAMembers }, players: hub.players, nights: hub.nights }, { id: "group-b", name: "Group B", discordUrl: "", members: {}, players: [], nights: [] }];
}
