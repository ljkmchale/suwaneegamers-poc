import { describe, expect, it, vi } from "vitest";
import type { NavSection } from "@/lib/nav";
const lookup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ getDb: () => ({ prepare: () => ({ get: lookup }) }) }));
vi.mock("@/lib/contentFiles", () => ({ readContent: () => { throw new Error("Use initial data"); }, writeContent: vi.fn() }));
import { warcraftGroups, getWarcraftHub } from "@/lib/wowForever";
import { isWarcraftInvitee, warcraftMenuForViewer, selectWarcraftGroup } from "@/lib/warcraftInvitations";

describe("Warcraft menu invitations", () => {
  it("accepts only the six invited account IDs, including Ty", () => {
    for (const id of ["390a0a45aadcfeb14b33989c", "b2f082fa8ccad583d3523435", "84a012426ea6409e052ac880", "c71df713027bb52bfb23ac72", "a4ac974e235cb8705e5e2824", "3ef235a3385aca5bfff5f0e5"]) {
      lookup.mockReturnValue({ id });
      expect(isWarcraftInvitee(" Member@Example.com ")).toBe(true);
      expect(lookup).toHaveBeenLastCalledWith("member@example.com");
    }
    lookup.mockReturnValue({ id: "uninvited" });
    expect(isWarcraftInvitee("other@example.com")).toBe(false);
    lookup.mockReturnValue(undefined);
    expect(isWarcraftInvitee("unknown@example.com")).toBe(false);
    expect(isWarcraftInvitee()).toBe(false);
  });
  it("removes Warcraft links before sending desktop and mobile navigation to the browser", () => {
    const sections: NavSection[] = [
      { id: "primary", label: "Primary", items: [{ id: "map", label: "Map", href: "/maps-of-myrdae" }, { id: "nested", label: "Chronicles", href: "/wow-forever/chronicles#chapter" }] },
      { id: "wow-forever-nav", label: "WoW Forever", presentation: "links", items: [{ id: "wow", label: "WoW Forever", href: "/wow-forever" }] },
      { id: "tools", label: "Tools", items: [] },
    ];
    expect(warcraftMenuForViewer(sections, false).map(s => s.id)).toEqual(["primary", "tools"]);
    expect(warcraftMenuForViewer(sections, false)[0].items.map(i => i.id)).toEqual(["map"]);
    expect(warcraftMenuForViewer(sections, true)).toEqual(sections);
    expect(sections[0].items).toHaveLength(2);
  });
});

describe("Warcraft group isolation", () => {
  it("preserves Group A and starts Group B empty", () => {
    const groups = warcraftGroups(getWarcraftHub());
    expect(groups[0].players).toHaveLength(6);
    expect(groups[1]).toMatchObject({ id: "group-b", players: [], nights: [], members: {}, discordUrl: "https://discord.com/channels/319954674188943362/1562913577373925478" });
  });
  it("selects only assigned groups and rejects forged group URLs", () => {
    const groups = warcraftGroups(getWarcraftHub());
    groups[1].members.other = "New player";
    expect(selectWarcraftGroup(groups, "other", false).group?.id).toBe("group-b");
    expect(selectWarcraftGroup(groups, "other", false, "group-a").group).toBeUndefined();
    expect(selectWarcraftGroup(groups, undefined, false).group).toBeUndefined();
    expect(selectWarcraftGroup(groups, undefined, true, "group-b").group?.id).toBe("group-b");
    groups[0].members.other = "New player";
    expect(selectWarcraftGroup(groups, "other", false).available).toHaveLength(2);
  });
});
