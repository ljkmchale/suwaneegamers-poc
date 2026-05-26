import { describe, expect, it } from "vitest";
import { activeCampaigns, parseLegacyCampaignSessionSummariesFromHtml } from "@/lib/campaigns";

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
