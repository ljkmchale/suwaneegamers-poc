import type { CalendarEvent } from "@/lib/calendar";

export interface CampaignSessionSummary {
  title: string;
  summary: string;
}

export interface PortalCampaign {
  id: string;
  name: string;
  dm: string;
  schedule: string;
  description: string;
  referenceUrl: string;
  headerImage?: string;
  headerImagePosition?: string;
  official?: boolean;
  resources?: string[];
  party?: string[];
  sessionSummaries?: CampaignSessionSummary[];
  aliases?: string[];
}

export const activeCampaigns: PortalCampaign[] = [
  {
    id: "a-new-adventure",
    name: "A New Adventure",
    dm: "Chip Poole",
    schedule: "1st & 3rd Thursday",
    referenceUrl: "https://sites.google.com/view/suwanee-gamers/campaigns/a-new-adventure",
    headerImage:
      "https://lh3.googleusercontent.com/sitesv/AA5AbUCqsdysBdSdLay2Bkm1BbpfwKXMol9JGjesD4f65daNfymoB7bwGgj_A8EulP39fHF7vtOUHonV09PLxaGclS_Zi0Q5y6X_AG0pOWhmcA6P335fcVkSQ6tIoNfBHLaU_laE-UKiR6-NcLErN6jgebDL-YQarHRe0zMpuxEI5zbp2Wj7eo6_zwZ2mSg=w16383",
    resources: ["D&D Beyond", "Notes"],
    party: ["Az'efal", "Cerul", "Fungus", "Kaizo", "Relys", "Ridley"],
    description:
      "A classic Myrdae campaign built around exploration, table discovery, and the next generation of heroes stepping into a changed world.",
    sessionSummaries: [
      {
        title: "Session 27 - Don't Threaten Us",
        summary:
          "The caravan was confronted by an elvish wizard and a burly warrior demanding the prisoners' release. The fight ended with the attackers dead, but Ridley's long-sought robed elf escaped during the chaos.",
      },
      {
        title: "Session 26 - To Caelora and Beyond",
        summary:
          "The party escorted wagons toward Shademoor, uncovered one of Ridley's targets among the prisoners, gained a bulas named Trygg, and defeated an oni and trolls at a stone bridge.",
      },
    ],
  },
  {
    id: "bloody-endeavor",
    name: "Bloody Endeavor",
    dm: "Sean Poole",
    schedule: "Mondays",
    referenceUrl: "https://sites.google.com/view/suwanee-gamers/campaigns/bloody-endeavor",
    headerImage:
      "https://lh3.googleusercontent.com/sitesv/AA5AbUBqBj7yTHvyd_crvae7ZGsPn1g1Ej_hnJTLNHJfLxyDedu8wxkXpXFpCgWMOZ1auadg4hF7IatRCDK0ZclUywqOfShe6Cbt0p5UNcQceCOgK45HAP2xUq3hwHO09fx2zt57MbPTGDcg-DUFeQ38JLrtmoZwZs5wtgWVzXrsHl_Rn7Ri_-PPiKIw=w16383",
    resources: ["D&D Beyond", "Notes"],
    party: ["Albross", "Caelion", "Lucerion", "Pagern", "Rhody"],
    description:
      "A darker campaign of hard choices, blood-soaked consequences, and morally tangled stories in the rougher corners of Myrdae.",
    sessionSummaries: [
      {
        title: "Session 35 - Bloody Endeavor: Civil War",
        summary:
          "Wyrm Bane entered the Ring of Respect, defeated the Sacred Crows, gained access to Khagdaruhel, researched the city's lords, and prepared for an imperial audience.",
      },
      {
        title: "Session 34 - Greatest of All Time",
        summary:
          "The group recovered the blind goat, cleared drow-held towers, reached Khagdaruhel, and began the Ring of Respect challenges.",
      },
    ],
  },
  {
    id: "collective-of-myrdae",
    name: "Collective of Myrdae",
    dm: "Rotating DMs",
    schedule: "Varies by table",
    referenceUrl: "https://sites.google.com/view/suwanee-gamers/campaigns/collective-of-myrdae",
    headerImage:
      "https://lh3.googleusercontent.com/sitesv/AA5AbUB9iTteCVLT5GHWfZKqG-RRSVJsjjRAYTRI-rL5LldJfMuJP6ysJ5INFJWcKgZ37Hgm7Ea0fRk9o-DL97ZqRBa8x-FHrfEoT_Ez0mEHHl_JD3whyV7pqaiH3kc8fRSPB8fRerU58uvgGoRt2umyvNv3dWqN-O5TiKUjjXr2jpJJMpKRo8w64ceD=w16383",
    official: false,
    resources: ["Campaign Link (A)", "Campaign Link (B)", "Join Link A", "Join Link (B)", "Collective Availability"],
    description:
      "A pickup-group pool for players to keep characters ready for smaller adventures and shared sessions across the wider table.",
    sessionSummaries: [
      {
        title: "Pickup Character Pool",
        summary:
          "This is not an official campaign. It is a place for players to keep characters ready for pickup groups or smaller session groups using D&D 2024 rules.",
      },
    ],
  },
  {
    id: "dungeons-iii",
    name: "Dungeons III",
    dm: "Lesley Poole",
    schedule: "Mondays",
    referenceUrl: "https://sites.google.com/view/suwanee-gamers/campaigns/dungeons-iii",
    headerImage:
      "https://lh3.googleusercontent.com/sitesv/AA5AbUAUx3sOeoxLjrGnzpFG7nG8GiqYH8Bu11y0DPZvfPPYdbcbXgONN7vh_HwtZ_TEkicm_J6TT8v5W2ZWQKB73BJr0EWr04BFKQRqgB1_Vg5wUE3XInxglqUQIEN_2yDFAhDpLhngDDnbHJYf3NbdT7pi1kvb1uPFj2L4Eor3cvDdLYs7DbUCKwns424=w16383",
    resources: ["D&D Beyond", "Notes"],
    party: ["Æon", "Draelith", "Meles", "Nixie", "Nova", "Seraphine"],
    description:
      "A dungeon-forward adventure with inventive encounters, table momentum, and old-school discovery in the world of Myrdae.",
    sessionSummaries: [
      {
        title: "Session 11 - Sand People Get In All the Crevices",
        summary:
          "The kNight Watch pressed into the Jagged Waste Crags, defeated Mahruudian Raiders, claimed mounts and supplies, and ended in a suspicious cave.",
      },
      {
        title: "Session 10 - It's a Long Ass Way!",
        summary:
          "The party rode from Scarwatch Hold toward the eastern crags, found Isgo's horse, survived difficult travel, and came under attack near the cult outpost.",
      },
    ],
  },
  {
    id: "heroes-of-emberstran",
    name: "Heroes of Emberstran",
    dm: "Chip Poole",
    schedule: "No cadence",
    referenceUrl: "https://sites.google.com/view/suwanee-gamers/campaigns/heroes-of-emberstran",
    headerImage:
      "https://lh3.googleusercontent.com/sitesv/AA5AbUDDjQhNwn2I26JI1hRIG4aRdON0ND_XPlDnnD0EPUYGHXLOzudRq8lkBCZ6FA9yYCES6x_i_Dzejf50I9uIF-Cwf6xPmGT6ppNfaWIlRc0XG1c4UXn90Cxywo-PBOQz_1JIsnSf6bSUveatgkswCAvlHjmUBlL-hCM1nZD2U8BDPVt95IUJn1pn=w16383",
    resources: ["D&D Beyond", "Notes"],
    party: ["Ainslie", "Aurelius", "Hap", "Ky'tha", "Og", "Zymve"],
    description:
      "Heroes rise near volcanic Mount Emberstran, where dwarven holds, Bathaen wilds, and ancient danger meet.",
    sessionSummaries: [
      {
        title: "Session 25 - Grief Stricken",
        summary:
          "The party entered the Emberheart Vault, faced trials and a spectral guardian, met Irragosa, and returned to Emberstran carrying grim news from Ulgrey.",
      },
      {
        title: "Session 24 - Let the Bodies Hit the Floor",
        summary:
          "The heroes followed the Emberheart Tablet through Mount Emberstran, survived a firenewt ambush, sheltered with rock gnomes, and opened a dark corridor ahead.",
      },
    ],
    aliases: ["emberstran"],
  },
  {
    id: "mad-mage",
    name: "Mad Mage",
    dm: "Michael Hewson",
    schedule: "2nd Saturday",
    referenceUrl: "https://sites.google.com/view/suwanee-gamers/campaigns/mad-mage",
    headerImage:
      "https://lh3.googleusercontent.com/sitesv/AA5AbUAbgVaF1MOf7uhCbzuAaXR8i4zpIJbqHKAP2waXrAO7fmKa69whqKfqMnn7wX_OAl6dYKA4biF5hiG3Fs7xX8dzFRw-yNXI0eGV8CrE8M7yfHbu7fP8-sOyA0l28UgLKOuVZgwO6pezChT6hpaNxyXiaikWakSWRSCvyxpxwuy9uDia3R1N3npyPQg=w16383",
    resources: ["Player's Notes"],
    description:
      "A campaign of arcane mysteries, unstable power, hidden agendas, and strange discoveries beneath the surface of Myrdae.",
    sessionSummaries: [
      {
        title: "Dungeon of the Mad Mage",
        summary:
          "The legacy page currently presents this campaign as a Dungeon of the Mad Mage hub with player notes.",
      },
    ],
  },
  {
    id: "souls-of-destiny",
    name: "Souls of Destiny",
    dm: "Sean Poole",
    schedule: "Last Saturday",
    referenceUrl: "https://sites.google.com/view/suwanee-gamers/campaigns/souls-of-destiny",
    headerImage:
      "https://lh3.googleusercontent.com/sitesv/AA5AbUA5vhx8jjLp5QnUDbBxUhx77PVEiB5gFZ5acVnq-Wg2Fv06H8k02IaneJ6nov0I065Ozl60Vhy1ulz7rjnw3iKU2WSiITU2VQJDqgMlEnXnUAu27TtxhSaSFMR0krgqX4BnOmORLb0RKCRQWnnHBwQ1YzaE29WlhALnjQ-cqERA8GDl3PPkfPesE-k=w16383",
    headerImagePosition: "center 40%",
    resources: ["D&D Beyond", "Notes"],
    party: ["Escanor", "Therric", "Zephyra", "Lawrence", "Esylla", "Lila"],
    description:
      "A cult, poisoned wells, dark heart rituals, and unlikely heroes pulled into danger around Adsuren.",
    sessionSummaries: [
      {
        title: "07 - A Solid Plan",
        summary:
          "The party planned a raid beneath Adsuren Center, planted stolen gold to deflect blame, discovered cult rituals using hearts and black salt, and reached deep double doors below town.",
      },
      {
        title: "06 - Who Took It?",
        summary:
          "The group searched for the cult's ritual site, questioned townsfolk, found twitching rat heads and black-salt instructions, and tangled town suspicion with missing taxes.",
      },
    ],
  },
  {
    id: "the-silent-vanguard",
    name: "The Silent Vanguard",
    dm: "Michael Hewson",
    schedule: "1st & 3rd Wednesday",
    referenceUrl: "https://sites.google.com/view/suwanee-gamers/campaigns/the-silent-vanguard",
    headerImage:
      "https://lh3.googleusercontent.com/sitesv/AA5AbUBbKAamQ3jXX2cRfv-Eh0vREQIPwO4SyrMHOtROkaJRBUH_uQg6ZFiNBqsE9C1UuR8yC4BpWUU2ZPh3n29X47y6kEweidoQAfukcpzQcuEsedFYfALmdMy_tRzA14ePJwZO_KOV7NOR9u_1W-A08jQgZrctlMDLRYl9OSB-88CFcXoUmee5n8Tj=w16383",
    resources: ["D&D Beyond", "Notes"],
    party: [
      "Jett Blackwood",
      "Bedet'Tul",
      "Lensworth Fistlemuch",
      "Dax Whirren",
      "Fosslenob Gripefoot",
      "Axel Blackwood",
      "Cletus Rashgut",
      "Kern",
      "Ivy Blackthorn",
    ],
    description:
      "Secret agents assembled by Master Thorne investigate outbreaks, conspiracies, and the ominous phrase The Long Night.",
    sessionSummaries: [
      {
        title: "02 - A Town Full of Zombies and a Mysterious Note",
        summary:
          "The party survived the zombie outbreak in Brinecross, escaped town, recovered clues about The Long Night, reported back in Tratta, and met Thorin aboard the ship.",
      },
      {
        title: "01 - We Meet",
        summary:
          "Master Thorne gathered six adventurers in Tratta under the cover of the Lower Dock markets and pulled them into a covert assignment.",
      },
    ],
    aliases: ["silent vanguard"],
  },
];

export const listedCampaigns = activeCampaigns.filter((campaign) => campaign.official !== false);

export const sideCampaigns = activeCampaigns.filter((campaign) => campaign.official === false);

export function findCampaign(id: string) {
  return activeCampaigns.find((campaign) => campaign.id === id);
}

export function normalizeCampaignTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findNextCampaignEvent(
  campaign: PortalCampaign,
  events: CalendarEvent[]
): CalendarEvent | undefined {
  const names = [campaign.name, ...(campaign.aliases ?? [])].map(normalizeCampaignTitle);

  return events
    .filter((event) => {
      const title = normalizeCampaignTitle(event.title);
      return names.some((name) => title === name || title.includes(name));
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
}

const LEGACY_STOP_MARKERS = [
  "Previous Characters",
  "Old Notes",
  "Google Sites",
  "Report abuse",
  "Page details",
  "Page updated",
];

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function legacyHtmlToLines(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "\n")
  )
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isSessionStart(line: string, nextLine = "") {
  if (/^session\s*\d/i.test(line)) return true;
  if (/^\d{1,2}\s*[-–—]/.test(line)) return true;
  return /^\d$/.test(line) && (/^\d$/.test(nextLine) || /^[-–—]$/.test(nextLine));
}

function titleNeedsMore(parts: string[]) {
  const title = parts.join(" ");
  return !/[-–—]\s*\S.{2,}/.test(title);
}

function normalizeSessionTitle(parts: string[]) {
  return parts
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/^Session\s+(\d)\s+(\d)\b/i, "Session $1$2")
    .replace(/^(\d)\s+(\d)\s*[-–—]/, "$1$2 -")
    .replace(/\s*[-–—]\s*/g, " - ")
    .trim();
}

function parseLegacySessionSummaries(lines: string[]): CampaignSessionSummary[] {
  const sessionHeadingIndex = lines.findIndex((line) => line.toLowerCase() === "session summaries");
  const firstSessionIndex = lines.findIndex((line, index) => isSessionStart(line, lines[index + 1]));
  let cursor = sessionHeadingIndex >= 0 ? sessionHeadingIndex + 1 : firstSessionIndex;

  if (cursor < 0) return [];

  const stopIndex = lines.findIndex(
    (line, index) => index > cursor && LEGACY_STOP_MARKERS.some((marker) => line === marker)
  );
  const end = stopIndex >= 0 ? stopIndex : lines.length;
  const summaries: CampaignSessionSummary[] = [];

  while (cursor < end) {
    const line = lines[cursor];
    const nextLine = lines[cursor + 1];

    if (!isSessionStart(line, nextLine)) {
      cursor += 1;
      continue;
    }

    const titleParts = [line];
    cursor += 1;

    while (cursor < end && titleNeedsMore(titleParts)) {
      titleParts.push(lines[cursor]);
      cursor += 1;
    }

    const summaryParts: string[] = [];
    while (cursor < end && !isSessionStart(lines[cursor], lines[cursor + 1])) {
      if (!LEGACY_STOP_MARKERS.some((marker) => lines[cursor] === marker)) {
        summaryParts.push(lines[cursor]);
      }
      cursor += 1;
    }

    const title = normalizeSessionTitle(titleParts);
    const summary = summaryParts.join(" ").replace(/\s+/g, " ").trim();

    if (title && summary) {
      summaries.push({ title, summary });
    }
  }

  return summaries;
}

export async function fetchLegacyCampaignSessionSummaries(campaign: PortalCampaign) {
  try {
    const response = await fetch(campaign.referenceUrl, {
      next: { revalidate: 300 },
    });

    if (!response.ok) return campaign.sessionSummaries ?? [];

    const html = await response.text();
    const parsed = parseLegacySessionSummaries(legacyHtmlToLines(html));
    return parsed.length > 0 ? parsed : campaign.sessionSummaries ?? [];
  } catch {
    return campaign.sessionSummaries ?? [];
  }
}
