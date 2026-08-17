import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const routeDir = path.join(process.cwd(), "app", "(site)", "advents_of_harmony");

describe("Advents of Harmony library", () => {
  it("exists as the public replacement for Chronicles", () => {
    expect(fs.existsSync(path.join(routeDir, "page.tsx"))).toBe(true);
    const nav = fs.readFileSync(path.join(process.cwd(), "lib", "nav.ts"), "utf8");
    expect(nav).toContain("/advents_of_harmony");
  });

  it("includes interactive reading and bookmark affordances", () => {
    const experience = fs.readFileSync(path.join(routeDir, "LibraryExperience.tsx"), "utf8");
    const scene = fs.readFileSync(path.join(routeDir, "LibraryScene.tsx"), "utf8");
    const css = fs.readFileSync(path.join(routeDir, "library.module.css"), "utf8");
    expect(experience).toContain("Place ribbon");
    expect(experience).toContain("localStorage");
    expect(experience).toContain("LibraryScene");
    expect(experience).toContain("/api/brain/source");
    expect(scene).toContain("<video");
    expect(scene.match(/<video/g)).toHaveLength(1);
    expect(scene).not.toContain("<div className={styles.entranceGlow}");
    expect(scene).not.toContain("<div className={styles.entrancePortal}");
    expect(css).toContain("object-fit:contain");
    expect(scene).toContain("advents-harmony-entrance-flova-v1.mp4");
    expect(scene).toContain("advents-harmony-exit-web-v1.mp4");
    expect(scene).toContain("styles.entranceDirectReveal");
    expect(scene).toContain("entranceState === \"closing\" ? \"closed\" : \"revealing\"");
    expect(scene).not.toContain("styles.libraryBlackout");
    expect(scene).not.toContain("\"blacking\"");
    expect(scene).not.toContain("setTimeout(() => setEntranceState(\"inside\")");
    expect(scene).not.toContain("setTimeout(() => setEntranceState(\"closed\")");
    expect(scene).not.toContain("styles.entranceOpen");
    expect(scene).not.toContain("styles.entranceClosing");
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
