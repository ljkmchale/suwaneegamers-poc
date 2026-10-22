import { readContent, writeContent } from "@/lib/contentFiles";

export type WarcraftPlayer = { name: string; status: string; character: string; className: string; level: string };
export type WarcraftNight = { id: string; date: string; title: string; notes: string };
export type WarcraftHub = { schedule: string; nextNight: string; realm: string; faction: string; objective: string; players: WarcraftPlayer[]; nights: WarcraftNight[] };

const initial: WarcraftHub = {
  schedule: "About once a week · day and time to be decided",
  nextNight: "First game night to be decided",
  realm: "To be decided", faction: "To be decided",
  objective: "Choose our realm and faction, create our characters, and begin the adventure together.",
  players: [
    { name: "Chip", status: "Confirmed", character: "", className: "Paladin (tentative)", level: "" },
    { name: "Lesley", status: "Confirmed", character: "", className: "Druid (tentative)", level: "" },
    { name: "Sean", status: "Confirmed", character: "", className: "Undecided", level: "" },
    { name: "Larry", status: "Confirmed", character: "", className: "Mage", level: "" },
    { name: "Emma", status: "Confirmed", character: "", className: "Hunter or Rogue", level: "" },
    { name: "Ty", status: "Maybe", character: "", className: "Undecided", level: "" },
  ],
  nights: [],
};

export function getWarcraftHub(): WarcraftHub {
  try { return readContent<WarcraftHub>("wow-forever.json"); }
  catch { return structuredClone(initial); }
}
export function saveWarcraftHub(hub: WarcraftHub) { writeContent("wow-forever.json", hub); }
