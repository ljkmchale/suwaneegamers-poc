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

  it("tracks Heroes of Emberstran player names", () => {
    const heroes = activeCampaigns.find((campaign) => campaign.id === "heroes-of-emberstran");

    expect(heroes?.party).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Ainslie", player: "Sean Poole" }),
        expect.objectContaining({ name: "Aurelius", player: "Larry McHale" }),
        expect.objectContaining({ name: "Hap", player: "Ty" }),
        expect.objectContaining({ name: "Ky'tha", player: "Lesley Poole" }),
        expect.objectContaining({ name: "Og", player: "Josh" }),
        expect.objectContaining({ name: "Zymve", player: "Emma" }),
      ]),
    );
  });
});
