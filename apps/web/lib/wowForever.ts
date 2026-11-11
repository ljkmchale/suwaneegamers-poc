import { readContent, writeContent } from "@/lib/contentFiles";

export type WarcraftPlayer = { name: string; hidden?: boolean; character: string; className: string; race?: string; specialization?: string; professions?: string; professionRanks?: string; faction?: string; gender?: string; level: string; image?: string; armoryUrl?: string };
export type WarcraftNight = { id: string; date: string; title: string; notes: string };
export type WarcraftGuild = { nominations: { id: string; name: string; nominatedBy: string }[]; votes: Record<string, string> };
export type WarcraftGroup = { dungeonCompletions?: Record<string, string[]>; id: string; name: string; partyName?: string; objective?: string; guild?: WarcraftGuild; discordUrl: string; members: Record<string, string>; players: WarcraftPlayer[]; nights: WarcraftNight[] };
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

// Read old combined class strings without requiring a live-data migration.
export function separateWarcraftDetails(player: WarcraftPlayer): WarcraftPlayer {
  const [className, ...details] = player.className.split(" · ");
  const professions = details.filter(value => /Tailoring|Enchanting|Leatherworking|Skinning/.test(value));
  const faction = details.find(value => /^(Alliance|Horde)$/.test(value));
  const gender = details.find(value => /^(Female|Male)$/.test(value));
  const other = details.filter(value => value !== faction && value !== gender && !professions.includes(value));
  return { ...player, className: [className, ...other].join(" · "), professions: player.professions ?? professions.join(" / "), faction: player.faction ?? faction, gender: player.gender ?? gender };
}

// Presentation only: keep hidden players and their memberships in stored data.
export function visibleWarcraftPlayers(players: WarcraftPlayer[]): WarcraftPlayer[] {
  return players.filter(player => !player.hidden);
}

export function getWarcraftHub(): WarcraftHub {
  try {
    const hub = readContent<WarcraftHub>("wow-forever.json");
    hub.players = hub.players.map(separateWarcraftDetails);
    if (hub.groups) hub.groups = hub.groups.map(group => ({ ...group, players: group.players.map(separateWarcraftDetails) }));
    return hub;
  }
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
  const groups = hub.groups ?? [{ id: "group-a", name: "Group A", discordUrl: "https://discord.com/channels/319954674188943362/325247957932834816", members: { ...warcraftGroupAMembers }, players: hub.players, nights: hub.nights }, { id: "group-b", name: "Group B", discordUrl: "https://discord.com/channels/319954674188943362/1562913577373925478", members: {}, players: [], nights: [] }];
  return groups.map((group, index) => ({ ...group, partyName: group.partyName?.trim() || ["Azeroth Adventurers", "Azeroth Explorers"][index] || `Adventure party ${index + 1}` }));
}
