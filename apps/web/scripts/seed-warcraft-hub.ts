import { getNavConfig, writeNavConfig } from "../lib/nav";
import { getWarcraftHub, saveWarcraftHub } from "../lib/wowForever";

// Preserve the DB-backed navigation, including all existing admin customizations.
const nav = getNavConfig();
nav.sections = nav.sections.filter(section => section.id !== "wow-forever-nav");
for (const section of nav.sections) section.items = section.items.filter(item => item.href !== "/wow-forever");
const aboutIndex = nav.sections.findIndex(section => section.label.toLowerCase() === "about");
nav.sections.splice(aboutIndex >= 0 ? aboutIndex : nav.sections.length, 0, {
  id: "wow-forever-nav", label: "WoW Forever", presentation: "links",
  items: [{ id: "wow-forever", href: "/wow-forever", label: "WoW Forever" }],
});
writeNavConfig(nav);
saveWarcraftHub(getWarcraftHub());
console.log("Warcraft hub and navigation saved to SQLite and JSON.");
