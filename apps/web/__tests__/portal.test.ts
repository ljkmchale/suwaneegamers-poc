import { describe, it, expect } from "vitest";
import {
  getPortalLinks,
  chroniclesLink,
  calendarLink,
  PORTAL_URLS,
} from "@/lib/portal";

describe("getPortalLinks", () => {
  it("returns a non-empty array", () => {
    expect(getPortalLinks().length).toBeGreaterThan(0);
  });

  it("every portal link has title, description, and href", () => {
    for (const link of getPortalLinks()) {
      expect(link.title,       `link missing title`).toBeTruthy();
      expect(link.description, `${link.title} missing description`).toBeTruthy();
      expect(link.href,        `${link.title} missing href`).toBeTruthy();
    }
  });

  it("all hrefs are absolute URLs or internal paths", () => {
    for (const link of getPortalLinks()) {
      const isAbsolute = link.href.startsWith("http://") || link.href.startsWith("https://");
      const isInternal = link.href.startsWith("/");
      expect(isAbsolute || isInternal, `"${link.href}" is neither absolute nor internal`).toBe(true);
    }
  });
});

describe("PORTAL_URLS", () => {
  it("chronicles uses the secure kb URL", () => {
    expect(PORTAL_URLS.chronicles).toBe("https://kb.suwaneegamers.net/");
  });

  it("referenceSite is an https Google Sites URL", () => {
    expect(PORTAL_URLS.referenceSite).toMatch(/^https:\/\/sites\.google\.com\//);
  });

  it("dndBeyond is the D&D Beyond URL", () => {
    expect(PORTAL_URLS.dndBeyond).toMatch(/dndbeyond\.com/);
  });

  it("calendar is the internal calendar path", () => {
    expect(PORTAL_URLS.calendar).toBe("/calendar");
  });
});

describe("chroniclesLink", () => {
  it("uses the Chronicles URL", () => {
    const link = chroniclesLink("Find everything here");
    expect(link.href).toBe(PORTAL_URLS.chronicles);
  });

  it("uses the provided description", () => {
    const link = chroniclesLink("Custom description");
    expect(link.description).toBe("Custom description");
  });

  it("has a title and label", () => {
    const link = chroniclesLink("desc");
    expect(link.title).toBeTruthy();
    expect(link.label).toBeTruthy();
  });
});

describe("calendarLink", () => {
  it("uses the internal calendar href", () => {
    const link = calendarLink();
    expect(link.href).toBe("/calendar");
  });

  it("provides a default description when none given", () => {
    const link = calendarLink();
    expect(link.description).toBeTruthy();
  });

  it("uses a custom description when provided", () => {
    const link = calendarLink("See when we play next.");
    expect(link.description).toBe("See when we play next.");
  });

  it("has a title and label", () => {
    const link = calendarLink();
    expect(link.title).toBeTruthy();
    expect(link.label).toBeTruthy();
  });
});
