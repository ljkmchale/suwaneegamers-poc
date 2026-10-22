import { getNavConfig, writeNavConfig } from "../lib/nav";
import { getWarcraftHub, saveWarcraftHub } from "../lib/wowForever";

// Preserve the DB-backed navigation, including all existing admin customizations.
const nav = getNavConfig();
const primary = nav.sections.find(section => section.id === "primary");
if (!primary) throw new Error("Primary navigation is missing");
if (!primary.items.some(item => item.href === "/wow-forever")) {
  const mapIndex = primary.items.findIndex(item => item.href === "/maps-of-myrdae");
  const journeyIndex = primary.items.findIndex(item => item.href === "/campaign-journeys");
  primary.items.splice(mapIndex >= 0 ? mapIndex + 1 : journeyIndex >= 0 ? journeyIndex : primary.items.length, 0,
    { id: "wow-forever", href: "/wow-forever", label: "WoW Forever" });
}
writeNavConfig(nav);
saveWarcraftHub(getWarcraftHub());
console.log("Warcraft hub and navigation saved to SQLite and JSON.");
