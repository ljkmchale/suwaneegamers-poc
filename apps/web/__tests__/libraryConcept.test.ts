import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { findSessionArtwork, uniqueBooks } from "@/app/(site)/advents_of_harmony/libraryBooks";

const routeDir = path.join(process.cwd(), "app", "(site)", "advents_of_harmony");

describe("Advents of Harmony library", () => {
  it("uses the same runic background as the home page", () => {
    const experience = fs.readFileSync(path.join(routeDir, "LibraryExperience.tsx"), "utf8");
    expect(experience).toContain('import { RunicBackground } from "../calendar/RunicBackground"');
    expect(experience).toContain("<RunicBackground />");
  });

  it("keeps the former library implementation available but routes the doorway to Myra", () => {
    expect(fs.existsSync(path.join(routeDir, "page.tsx"))).toBe(true);
    const page = fs.readFileSync(path.join(routeDir, "page.tsx"), "utf8");
    expect(page).toContain('import { MyraAvatarPoc } from "@/app/myra-avatar-poc/MyraAvatarPoc"');
    expect(page).toContain('<MyraAvatarPoc pagePath="/advents_of_harmony" />');
  });

  it("includes interactive reading and bookmark affordances", () => {
    const experience = fs.readFileSync(path.join(routeDir, "LibraryExperience.tsx"), "utf8");
    const scene = fs.readFileSync(path.join(routeDir, "LibraryScene.tsx"), "utf8");
    const css = fs.readFileSync(path.join(routeDir, "library.module.css"), "utf8");
    expect(experience).toContain("Place ribbon");
    expect(experience).toContain("localStorage");
    expect(experience).toContain('(max-width: 620px)');
    expect(experience).toContain("singlePageBook");
    expect(experience).toContain("book.sourcePaths");
    expect(experience).toContain("citation pattern");
    expect(experience).toContain("raw hash");
    expect(experience).toContain("Appendix: Party Reference");
    expect(experience).toContain("LibraryScene");
    expect(experience).toContain("/api/brain/source");
    expect(scene).toContain("<video");
    expect(scene.match(/<video/g)).toHaveLength(1);
    expect(scene).not.toContain("<div className={styles.entranceGlow}");
    expect(scene).not.toContain("<div className={styles.entrancePortal}");
    expect(css).toContain("object-fit:contain");
    expect(scene).toContain("advents-harmony-entrance-journey-v1.mp4");
    expect(scene).not.toContain("entranceClip");
    expect(scene).not.toContain("advents-harmony-inside-library-v1.mp4");
    expect(scene).toContain("advents-harmony-entrance-flova-poster-v2.webp");
    expect(scene).not.toContain("advents-harmony-entrance-flova-v1.mp4");
    expect(scene).toContain("styles.entranceDirectReveal");
    expect(scene).toContain("styles.entranceReturnReveal");
    expect(scene).toContain("setEntranceState(\"returning\")");
    expect(scene).toContain("video.currentTime = 0");
    expect(scene).toContain("Skip intro");
    expect(scene).toContain("styles.skipEntrance");
    expect(scene).toContain("function skipEntrance()");
    expect(scene).toContain('entranceState === "closed" || entranceState === "opening"');
    expect(scene).toContain('setEntranceState("inside")');
    expect(css).toContain(".skipEntrance");
    expect(scene).not.toContain("advents-harmony-exit-web-v1.mp4");
    expect(scene).not.toContain("\"closing\"");
    expect(scene).not.toContain("styles.libraryBlackout");
    expect(scene).not.toContain("\"blacking\"");
    expect(scene).not.toContain("setTimeout(() => setEntranceState(\"inside\")");
    expect(scene).not.toContain("setTimeout(() => setEntranceState(\"closed\")");
    expect(scene).not.toContain("styles.entranceOpen");
    expect(scene).not.toContain("styles.entranceClosing");
    expect(scene).toContain("Exit the Library");
    expect(scene).toContain("styles.aisleCount");
    expect(css).toContain("overflow-x:clip");
    expect(css).toContain("card-catalog-cabinet-v3.webp");
    expect(scene).not.toContain("Return through the doors");
  });

  it("does not truncate campaign histories in the retained library implementation", () => {
    const page = fs.readFileSync(path.join(routeDir, "FullLibraryPage.tsx"), "utf8");
    const css = fs.readFileSync(path.join(routeDir, "library.module.css"), "utf8");
    expect(page).not.toContain("sessionSummaries?.slice(0, 2)");
    expect(page).not.toContain("journey.stops.slice(0, 4)");
    expect(page).toContain('import { getActiveCampaigns } from "@/lib/campaigns"');
    expect(page).toContain("const campaigns = getActiveCampaigns()");
    expect(page).not.toContain('readContent<CampaignRecord[]>("campaigns.json")');
    expect(page).toContain("attachRelatedSources");
    expect(page).toContain("sourceByTitle");
    expect(page).toContain("preferredSourcePath ?? page.path");
    expect(css).toContain(".page{overflow-x:hidden;overflow-y:auto");
    expect(css).not.toContain(".page{overflow:hidden}");
  });

  it("keeps curated artwork and text when an archive title matches", () => {
    const [book] = uniqueBooks([
      {
        id: "place-adsuren",
        title: "Adsuren",
        subtitle: "Capital city",
        collection: "Atlas & Gazetteer",
        color: "#123456",
        image: "/media/images/locations/adsuren.webp",
        pages: ["Complete Gazetteer text"],
      },
      {
        id: "chronicles-wiki-adsuren",
        title: "Adsuren",
        subtitle: "World archive",
        collection: "World Archive",
        color: "#654321",
        image: "/media/images/maps-of-myrdae/locations-map.webp",
        pages: [],
        sourcePath: "wiki/locations/adsuren.md",
      },
    ]);

    expect(book.image).toBe("/media/images/locations/adsuren.webp");
    expect(book.pages).toEqual(["Complete Gazetteer text"]);
    expect(book.sourcePath).toBe("wiki/locations/adsuren.md");
  });

  it("opens session volumes on story sections with their available artwork", () => {
    const experience = fs.readFileSync(path.join(routeDir, "LibraryExperience.tsx"), "utf8");
    const css = fs.readFileSync(path.join(routeDir, "library.module.css"), "utf8");
    expect(experience).toContain("session metadata|source grounding");
    expect(experience).toContain('output.push(`§ ${headingText}`)');
    expect(experience).toContain("styles.bookSectionHeading");
    expect(experience).toContain("styles.bookBullet");
    expect(css).toContain(".bookSectionHeading");
    expect(css).toContain(".bookBullet");
    expect(findSessionArtwork("SoD Session 07 - A Solid Plan", "SoD"))
      .toBe("/media/images/chronicles/souls-of-destiny/session-07-secret-cellar-passage-v1.webp");
  });

  it("uses immersive shelves instead of a catalog or checkout grid", () => {
    const page = fs.readFileSync(path.join(routeDir, "page.tsx"), "utf8");
    const experience = fs.readFileSync(path.join(routeDir, "LibraryExperience.tsx"), "utf8");
    const scene = fs.readFileSync(path.join(routeDir, "LibraryScene.tsx"), "utf8");
    expect(experience).not.toContain("Browse the collection");
    expect(experience).not.toContain("checkout");
    expect(scene).toContain("Take ${book.title} from the shelf");
    expect(scene).toContain("The Living Chronicles");
    expect(scene).toContain("The World Archive");
    expect(scene.match(/name: "/g)).toHaveLength(2);
    expect(page).not.toContain("deities.slice(");
    expect(page).not.toContain("places.slice(");
    expect(page).not.toContain("campaigns.slice(");
    expect(scene).toContain("Math.ceil(sorted.length / 120)");
    expect(scene).toContain("Session Journals");
    expect(scene).toContain("Atlas & Gazetteer");
    expect(scene).toContain("Pantheon of Myrdae");
    expect(scene).toContain("compactShelf");
    expect(scene).toContain("Card Catalog");
    expect(scene).toContain("Search the card catalog");
    expect(scene).toContain("IntersectionObserver");
  });
});
