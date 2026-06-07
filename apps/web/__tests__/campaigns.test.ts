import { describe, expect, it } from "vitest";
import {
  activeCampaigns,
  findCampaign,
  listedCampaigns,
  sideCampaigns,
  normalizeCampaignTitle,
  findNextCampaignEvent,
  findCampaignForCalendarEvent,
  parseLegacyCampaignSessionSummariesFromHtml,
  type PortalCampaign,
} from "@/lib/campaigns";
import type { CalendarEvent } from "@/lib/calendar";

// ── Data shape ────────────────────────────────────────────────────────────────

describe("activeCampaigns — data shape", () => {
  it("is a non-empty array", () => {
    expect(activeCampaigns.length).toBeGreaterThan(0);
  });

  it("every campaign has required fields", () => {
    for (const c of activeCampaigns) {
      expect(c.id,          `${c.name} missing id`).toBeTruthy();
      expect(c.name,        `${c.id} missing name`).toBeTruthy();
      expect(c.dm,          `${c.id} missing dm`).toBeTruthy();
      expect(c.schedule,    `${c.id} missing schedule`).toBeTruthy();
      expect(c.referenceUrl, `${c.id} missing referenceUrl`).toBeTruthy();
    }
  });

  it("campaign IDs are unique", () => {
    const ids = activeCampaigns.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all referenceUrls are absolute https links", () => {
    for (const c of activeCampaigns) {
      expect(c.referenceUrl, `${c.id} bad referenceUrl`).toMatch(/^https?:\/\//);
    }
  });
});

describe("activeCampaigns resources", () => {
  it("uses real resource URLs instead of sending campaign buttons to legacy pages", () => {
    for (const campaign of activeCampaigns) {
      for (const resource of campaign.resources ?? []) {
        expect(resource.url).toMatch(/^https:\/\//);
        expect(resource.url).not.toBe(campaign.referenceUrl);
      }
    }
  });

  it("every resource has a label and url", () => {
    for (const campaign of activeCampaigns) {
      for (const resource of campaign.resources ?? []) {
        expect(resource.label).toBeTruthy();
        expect(resource.url).toBeTruthy();
      }
    }
  });
});

describe("activeCampaigns party links", () => {
  it("uses Google Docs links for linked character buttons", () => {
    for (const campaign of activeCampaigns) {
      for (const member of campaign.party ?? []) {
        if (member.url) {
          expect(member.url).toMatch(/^https:\/\/docs\.google\.com\/document\/d\//);
          expect(member.url).not.toBe(campaign.referenceUrl);
        }
      }
    }
  });

  it("tracks A New Adventure player names", () => {
    const adventure = activeCampaigns.find((campaign) => campaign.id === "a-new-adventure");

    expect(adventure?.party).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Az'efal", player: "Lesley Poole" }),
        expect.objectContaining({ name: "Cerul", player: "Ty Cooper" }),
        expect.objectContaining({ name: "Fungus", player: "Michael Hewson" }),
        expect.objectContaining({ name: "Kaizo", player: "Mike Brown" }),
        expect.objectContaining({ name: "Relys", player: "Emma Cooper" }),
        expect.objectContaining({ name: "Ridley", player: "Sean Poole" }),
      ]),
    );
  });

  it("tracks Bloody Endeavor player names", () => {
    const endeavor = activeCampaigns.find((campaign) => campaign.id === "bloody-endeavor");

    expect(endeavor?.party).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Albross", player: "Cooper" }),
        expect.objectContaining({ name: "Caelion", player: "Chuck" }),
        expect.objectContaining({ name: "Lucerion", player: "Chip Poole" }),
        expect.objectContaining({ name: "Pagern", player: "Tom Chernetsky" }),
        expect.objectContaining({ name: "Rhody", player: "Joshua John" }),
      ]),
    );
  });

  it("tracks Dungeons III player names", () => {
    const dungeons = activeCampaigns.find((campaign) => campaign.id === "dungeons-iii");

    expect(dungeons?.party).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Æon", player: "Tom Chernetsky" }),
        expect.objectContaining({ name: "Draelith", player: "Chip Poole" }),
        expect.objectContaining({ name: "Meles", player: "Brian" }),
        expect.objectContaining({ name: "Nixie", player: "Chuck" }),
        expect.objectContaining({ name: "Nova", player: "Tiffany Mulvihill" }),
        expect.objectContaining({ name: "Seraphine", player: "Suzanne Chernetsky" }),
      ]),
    );
  });

  it("tracks Heroes of Emberstran player names", () => {
    const heroes = activeCampaigns.find((campaign) => campaign.id === "heroes-of-emberstran");

    expect(heroes?.party).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Ainslie", player: "Sean Poole" }),
        expect.objectContaining({ name: "Aurelius", player: "Larry McHale" }),
        expect.objectContaining({ name: "Hap", player: "Ty Cooper" }),
        expect.objectContaining({ name: "Ky'tha", player: "Lesley Poole" }),
        expect.objectContaining({ name: "Og", player: "Joshua John" }),
        expect.objectContaining({ name: "Zymve", player: "Emma Cooper" }),
      ]),
    );
  });

  it("tracks Souls of Destiny player names", () => {
    const souls = activeCampaigns.find((campaign) => campaign.id === "souls-of-destiny");

    expect(souls?.party).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Escanor", player: "Brian" }),
        expect.objectContaining({ name: "Therric", player: "Chip Poole" }),
        expect.objectContaining({ name: "Zephyra", player: "Jenny McHale" }),
        expect.objectContaining({ name: "Kenton", player: "Larry McHale" }),
        expect.objectContaining({ name: "Esylla", player: "Lesley Poole" }),
        expect.objectContaining({ name: "Lila", player: "Tiffany Mulvihill" }),
      ]),
    );
    expect(souls?.party?.some((member) => member.name === "Lawrence")).toBe(false);
  });

  it("tracks Silent Vanguard player names", () => {
    const vanguard = activeCampaigns.find((campaign) => campaign.id === "the-silent-vanguard");

    expect(vanguard?.party).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Jett Blackwood", player: "Larry McHale" }),
        expect.objectContaining({ name: "Bedet'Tul", player: "Brian" }),
        expect.objectContaining({ name: "Lensworth Fistlemuch", player: "Tom Chernetsky" }),
        expect.objectContaining({ name: "Dax Whirren", player: "Suzanne Chernetsky" }),
        expect.objectContaining({ name: "Fosslenob Gripefoot", player: "Michael Hewson" }),
        expect.objectContaining({ name: "Axel Blackwood", player: "Larry McHale" }),
        expect.objectContaining({ name: "Cletus Rashgut", player: "Brian" }),
        expect.objectContaining({ name: "Kern", player: "Tom Chernetsky" }),
        expect.objectContaining({ name: "Ivy Blackthorn", player: "Suzanne Chernetsky" }),
      ]),
    );
    expect(vanguard?.party?.some((member) => member.name === "Kenton")).toBe(false);
  });
});

// ── findCampaign ──────────────────────────────────────────────────────────────

describe("findCampaign", () => {
  it("returns the campaign for a known id", () => {
    const c = findCampaign("heroes-of-emberstran");
    expect(c?.name).toBeTruthy();
    expect(c?.id).toBe("heroes-of-emberstran");
  });

  it("returns undefined for an unknown id", () => {
    expect(findCampaign("not-a-real-campaign")).toBeUndefined();
  });
});

// ── listedCampaigns / sideCampaigns ───────────────────────────────────────────

describe("listedCampaigns", () => {
  it("excludes campaigns with official === false", () => {
    const listed = listedCampaigns();
    expect(listed.every((c) => c.official !== false)).toBe(true);
  });

  it("includes campaigns with official === true or official undefined", () => {
    const listed = listedCampaigns();
    expect(listed.length).toBeGreaterThan(0);
  });
});

describe("sideCampaigns", () => {
  it("only returns campaigns where official is explicitly false", () => {
    const side = sideCampaigns();
    expect(side.every((c) => c.official === false)).toBe(true);
  });
});

// ── normalizeCampaignTitle ─────────────────────────────────────────────────────

describe("normalizeCampaignTitle", () => {
  it("lowercases the title", () => {
    expect(normalizeCampaignTitle("Heroes of Emberstran")).toBe("heroes of emberstran");
  });

  it("strips leading 'the '", () => {
    expect(normalizeCampaignTitle("The Silent Vanguard")).toBe("silent vanguard");
    expect(normalizeCampaignTitle("the silent vanguard")).toBe("silent vanguard");
  });

  it("does not strip 'the' mid-title", () => {
    expect(normalizeCampaignTitle("Into the Dark")).toBe("into the dark");
  });

  it("replaces non-alphanumeric sequences with spaces", () => {
    expect(normalizeCampaignTitle("Dungeons III")).toBe("dungeons iii");
    expect(normalizeCampaignTitle("A New Adventure!")).toBe("a new adventure");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCampaignTitle("  heroes  ")).toBe("heroes");
  });
});

// ── findNextCampaignEvent ──────────────────────────────────────────────────────

function makeEvent(title: string, start: string): CalendarEvent {
  return { uid: title, title, start, allDay: false };
}

describe("findNextCampaignEvent", () => {
  const campaign: PortalCampaign = {
    id: "heroes-of-emberstran",
    name: "Heroes of Emberstran",
    dm: "Larry McHale",
    schedule: "Biweekly",
    description: "",
    referenceUrl: "https://example.com",
  };

  it("matches an event by exact normalized title", () => {
    const events = [makeEvent("Heroes of Emberstran", "2026-06-01T18:00:00Z")];
    const found = findNextCampaignEvent(campaign, events);
    expect(found?.title).toBe("Heroes of Emberstran");
  });

  it("returns the earliest matching event when multiple match", () => {
    const events = [
      makeEvent("Heroes of Emberstran", "2026-06-15T18:00:00Z"),
      makeEvent("Heroes of Emberstran", "2026-06-01T18:00:00Z"),
    ];
    const found = findNextCampaignEvent(campaign, events);
    expect(found?.start).toBe("2026-06-01T18:00:00Z");
  });

  it("matches via alias", () => {
    const campaignWithAlias: PortalCampaign = {
      ...campaign,
      aliases: ["HoE"],
    };
    const events = [makeEvent("HoE", "2026-06-01T18:00:00Z")];
    const found = findNextCampaignEvent(campaignWithAlias, events);
    expect(found?.title).toBe("HoE");
  });

  it("returns undefined when no events match", () => {
    const events = [makeEvent("Completely Different Campaign", "2026-06-01T18:00:00Z")];
    expect(findNextCampaignEvent(campaign, events)).toBeUndefined();
  });

  it("returns undefined for an empty event list", () => {
    expect(findNextCampaignEvent(campaign, [])).toBeUndefined();
  });

  it("strips 'the' prefix from event title when matching", () => {
    const silentVanguard: PortalCampaign = {
      ...campaign,
      id: "the-silent-vanguard",
      name: "The Silent Vanguard",
    };
    const events = [makeEvent("The Silent Vanguard", "2026-06-01T18:00:00Z")];
    const found = findNextCampaignEvent(silentVanguard, events);
    expect(found).toBeDefined();
  });
});

// ── parseLegacyCampaignSessionSummariesFromHtml ────────────────────────────────

describe("findCampaignForCalendarEvent", () => {
  const campaigns: PortalCampaign[] = [
    {
      id: "heroes-of-emberstran",
      name: "Heroes of Emberstran",
      dm: "Larry McHale",
      schedule: "Biweekly",
      description: "",
      referenceUrl: "https://example.com",
      headerImage: "/images/campaigns/heroes-of-emberstran.jpg",
      aliases: ["Emberstran"],
    },
  ];

  it("returns the matching campaign for an event title", () => {
    const found = findCampaignForCalendarEvent(
      makeEvent("Heroes of Emberstran", "2026-06-01T18:00:00Z"),
      campaigns,
    );

    expect(found?.id).toBe("heroes-of-emberstran");
  });

  it("matches aliases inside longer event titles", () => {
    const found = findCampaignForCalendarEvent(
      makeEvent("Emberstran Session Night", "2026-06-01T18:00:00Z"),
      campaigns,
    );

    expect(found?.id).toBe("heroes-of-emberstran");
  });

  it("returns undefined when no campaign matches", () => {
    const found = findCampaignForCalendarEvent(
      makeEvent("Open Board Game Night", "2026-06-01T18:00:00Z"),
      campaigns,
    );

    expect(found).toBeUndefined();
  });
});

describe("parseLegacyCampaignSessionSummariesFromHtml", () => {
  it("keeps Google Drive audio links attached to matching session summaries", () => {
    const summaries = parseLegacyCampaignSessionSummariesFromHtml(`
      <section>
        <p><span>Session Summaries</span></p>
      </section>
      <section>
        <a href="https://drive.google.com/file/d/audio-27/view?usp=sharing">
          <img src="play.png" alt="Session audio" />
        </a>
        <p><span>Session 27 - Don't Threaten Us</span></p>
        <p><span>The caravan was confronted by an elvish wizard.</span></p>
      </section>
      <section>
        <a href="https://docs.google.com/document/d/not-audio/edit">Notes</a>
        <p><span>Session 26 - To Caelora and Beyond</span></p>
        <p><span>The party escorted wagons toward Shademoor.</span></p>
      </section>
    `);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      title: "Session 27 - Don't Threaten Us",
      summary: "The caravan was confronted by an elvish wizard.",
      audioLinks: [
        {
          label: "Session Audio",
          url: "https://drive.google.com/file/d/audio-27/view?usp=sharing",
        },
      ],
    });
    expect(summaries[1]?.audioLinks).toBeUndefined();
  });

  it("returns empty array for HTML with no sessions", () => {
    const result = parseLegacyCampaignSessionSummariesFromHtml(`
      <section><p>No sessions here</p></section>
    `);
    expect(result).toEqual([]);
  });

  it("decodes HTML entities in session text", () => {
    const summaries = parseLegacyCampaignSessionSummariesFromHtml(`
      <section>
        <p>Session 1 - Goblin&#39;s Den</p>
        <p>The party entered the goblin&amp;s lair.</p>
      </section>
    `);
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries[0].title).toContain("Goblin");
  });

  it("stops at a legacy stop marker", () => {
    const summaries = parseLegacyCampaignSessionSummariesFromHtml(`
      <section>
        <p>Session 1 - The Beginning</p>
        <p>The party set out.</p>
        <p>Old Notes</p>
        <p>Session 2 - Should Not Appear</p>
        <p>This should be excluded.</p>
      </section>
    `);
    expect(summaries.some((s) => s.title.includes("Should Not Appear"))).toBe(false);
  });

  it("parses sessions using 'Session N - Title' format", () => {
    // isSessionStart matches /^session\s*\d/i
    const summaries = parseLegacyCampaignSessionSummariesFromHtml(`
      <section>
        <p>Session 1 - The First Adventure</p>
        <p>The heroes began their quest into the mountains.</p>
      </section>
    `);
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries[0].title).toContain("Session 1");
  });

  it("ignores non-Drive audio links", () => {
    const summaries = parseLegacyCampaignSessionSummariesFromHtml(`
      <section>
        <a href="https://docs.google.com/document/d/some-doc/edit">Notes</a>
        <p>Session 5 - Side Quest</p>
        <p>The party went exploring.</p>
      </section>
    `);
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries[0].audioLinks).toBeUndefined();
  });
});
