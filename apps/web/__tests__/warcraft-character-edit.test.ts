// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
const mocks = vi.hoisted(() => ({ admin: false, owner: "Larry" as string | undefined, save: vi.fn(), write: vi.fn(), blocked: false, hub: {} as any }));
vi.mock("@/lib/adminSession", () => ({ getAdminSession: async () => ({ isAdmin: mocks.admin }) }));
vi.mock("@/lib/userSession", () => ({ getUserSession: async () => ({ email: "member@example.com" }) }));
vi.mock("@/lib/warcraftInvitations", () => ({ getWarcraftPlayerName: () => mocks.owner, getWarcraftProfileId: () => mocks.owner ? "member-id" : undefined }));
vi.mock("@/lib/memberBlocks", () => ({ isMemberBlocked: () => mocks.blocked }));
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/wowForever", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/wowForever")>(), getWarcraftHub: () => structuredClone(mocks.hub), saveWarcraftHub: mocks.save }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, default: actual, mkdir: vi.fn(), writeFile: mocks.write };
});
import { updateWarcraftDungeon, updateWarcraftCharacter, addWarcraftNight, deleteWarcraftNight } from "@/app/(site)/wow-forever/actions";

function form(player: string) { const data = new FormData(); data.set("player", player); data.set("character", "Arcane friend"); data.set("className", "Mage"); data.set("level", "12"); return data; }
beforeEach(() => {
  mocks.blocked = false; mocks.admin = false; mocks.owner = "Larry"; mocks.save.mockClear(); mocks.write.mockClear();
  mocks.hub = { nextNight: "2026-11-06", nights: [], players: [
    { name: "Larry", character: "Old name", className: "Mage", level: "1", image: "/media/images/wow-forever/characters/old.webp" },
    { name: "Chip", character: "Chip's hero", className: "Paladin", level: "7" },
  ] };
});
describe("Warcraft character ownership", () => {
  it("rejects editing another player and uninvited accounts", async () => {
    expect((await updateWarcraftCharacter({}, form("Chip"))).error).toBeTruthy();
    mocks.owner = undefined;
    expect((await updateWarcraftCharacter({}, form("Larry"))).error).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("updates the owner while preserving the image, plans, and other players", async () => {
    const data = form("Larry");
    data.set("race", "Skyborne");
    data.set("professions", "Tailoring / Enchanting");
    expect((await updateWarcraftCharacter({}, data)).success).toBeTruthy();
    const saved = mocks.save.mock.calls[0][0];
    expect(saved.players[0].race).toBe("Skyborne");
    expect(saved.players[0].professions).toBe("Tailoring / Enchanting");
    expect(saved.players[0].character).toBe("Arcane friend");
    expect(saved.players[0].image).toBe(mocks.hub.players[0].image);
    expect(saved.players[1]).toEqual(mocks.hub.players[1]);
    expect(saved.nextNight).toBe("2026-11-06");
  });
  it("lets an admin edit another player and remove their image", async () => {
    mocks.admin = true; mocks.owner = undefined;
    const data = form("Larry"); data.set("removeImage", "on");
    expect((await updateWarcraftCharacter({}, data)).success).toBeTruthy();
    expect(mocks.save.mock.calls[0][0].players[0].image).toBeUndefined();
  });
  it("decodes and stores uploaded images as unique local WebP assets", async () => {
    const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } }).png().toBuffer();
    const data = form("Larry");
    const file = new File([new Uint8Array(bytes)], "portrait.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new Uint8Array(bytes).buffer });
    data.set("image", file);
    const originalGet = data.get.bind(data);
    vi.spyOn(data, "get").mockImplementation(key => key === "image" ? file : originalGet(key));
    expect((await updateWarcraftCharacter({}, data)).success).toBeTruthy();
    expect(mocks.write).toHaveBeenCalledOnce();
    expect(mocks.save.mock.calls[0][0].players[0].image).toMatch(/^\/media\/images\/wow-forever\/characters\/[a-f0-9-]+\.webp$/);
  });
});

describe("Warcraft group writes", () => {
  it("keeps a Group B character edit out of Group A", async () => {
    mocks.admin = true;
    const original = structuredClone(mocks.hub.players);
    mocks.hub.groups = [
      { id: "group-a", name: "Group A", members: {}, players: structuredClone(original), nights: [] },
      { id: "group-b", name: "Group B", members: {}, players: [{ ...original[0], character: "B hero" }], nights: [] },
    ];
    const data = form("Larry"); data.set("groupId", "group-b");
    expect((await updateWarcraftCharacter({}, data)).success).toBeTruthy();
    const saved = mocks.save.mock.calls[0][0];
    expect(saved.groups[0].players).toEqual(original);
    expect(saved.groups[1].players[0].character).toBe("Arcane friend");
  });
  it("adds and removes chapters only in the targeted group", async () => {
    mocks.hub.groups = [
      { id: "group-a", members: {}, players: [], nights: [{ id: "shared-id", title: "A", date: "2026-10-23", notes: "A story" }] },
      { id: "group-b", members: {}, players: [], nights: [{ id: "shared-id", title: "B", date: "2026-10-23", notes: "B story" }] },
    ];
    const data = new FormData(); data.set("groupId", "group-b"); data.set("date", "2026-10-23"); data.set("title", "New B chapter"); data.set("notes", "B adventure");
    await addWarcraftNight(data);
    expect(mocks.save.mock.calls[0][0].groups[0].nights).toHaveLength(1);
    expect(mocks.save.mock.calls[0][0].groups[1].nights).toHaveLength(2);
    mocks.save.mockClear(); data.set("id", "shared-id");
    await deleteWarcraftNight(data);
    expect(mocks.save.mock.calls[0][0].groups[0].nights).toHaveLength(1);
    expect(mocks.save.mock.calls[0][0].groups[1].nights).toHaveLength(0);
  });
});


describe("legacy character details", () => {
  it("separates professions while preserving faction and gender", async () => {
    const { separateWarcraftDetails } = await import("@/lib/wowForever");
    const player = separateWarcraftDetails({ name: "Larry", character: "Hero", className: "Mage · Alliance · Tailoring / Enchanting", level: "11" });
    expect(player).toMatchObject({ className: "Mage", faction: "Alliance", professions: "Tailoring / Enchanting", level: "11" });
    expect(separateWarcraftDetails({ ...player, className: "Shaman · Female", professions: "Herbalism" })).toMatchObject({ className: "Shaman", gender: "Female", professions: "Herbalism" });
  });
});


describe("party readiness goal", () => {
  it("changes only the selected party goal", async () => {
    const { updateWarcraftHub } = await import("@/app/(site)/wow-forever/actions");
    mocks.hub.objective = "Shared exploration";
    mocks.hub.groups = [
      { id: "group-a", members: {}, players: [], nights: [] },
      { id: "group-b", objective: "Group B goal", members: {}, players: [], nights: [] },
    ];
    const data = new FormData(); data.set("groupId", "group-a"); data.set("objective", "Level 13–18 for Hall of Thanes");
    await updateWarcraftHub(data);
    const saved = mocks.save.mock.calls[0][0];
    expect(saved.groups[0].objective).toBe("Level 13–18 for Hall of Thanes");
    expect(saved.groups[1].objective).toBe("Group B goal");
    expect(saved.objective).toBe("Shared exploration");
  });
});


describe("hidden Warcraft players", () => {
  it("excludes undecided players from display without deleting their records", async () => {
    const { visibleWarcraftPlayers } = await import("@/lib/wowForever");
    const players = [{ name: "Ty", hidden: true, character: "", className: "Undecided", level: "1" }, { name: "Larry", character: "Xypher", className: "Mage", level: "14" }];
    expect(visibleWarcraftPlayers(players).map(p => p.name)).toEqual(["Larry"]);
    expect(players).toHaveLength(2);
    players[0].hidden = false;
    expect(visibleWarcraftPlayers(players).map(p => p.name)).toEqual(["Ty", "Larry"]);
  });
});


describe("party guild nominations and votes", () => {
  beforeEach(() => {
    mocks.hub.groups = [
      { id: "group-a", name: "A", members: { "member-id": "Larry", "chip-id": "Chip" }, players: [], nights: [], guild: { nominations: [{ id: "one", name: "Azeroth Friends", nominatedBy: "chip-id" }, { id: "two", name: "Suwanee Heroes", nominatedBy: "chip-id" }], votes: { "chip-id": "one" } } },
      { id: "group-b", name: "B", members: {}, players: [], nights: [], guild: { nominations: [{ id: "b-one", name: "B Guild", nominatedBy: "other" }], votes: {} } },
    ];
  });
  it("normalizes nominations, rejects duplicates and preserves the other party", async () => {
    const { nominateWarcraftGuild } = await import("@/app/(site)/wow-forever/actions");
    const data = new FormData(); data.set("groupId", "group-a"); data.set("guildName", "  New   Guild  ");
    expect((await nominateWarcraftGuild({}, data)).success).toBeTruthy();
    expect(mocks.save.mock.calls[0][0].groups[0].guild.nominations[2]).toMatchObject({ name: "New Guild", nominatedBy: "member-id" });
    expect(mocks.save.mock.calls[0][0].groups[1]).toEqual(mocks.hub.groups[1]);
    mocks.save.mockClear(); data.set("guildName", "AZEROTH FRIENDS");
    expect((await nominateWarcraftGuild({}, data)).error).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("allows exactly one changeable vote and rejects another party's candidate", async () => {
    const { voteWarcraftGuild } = await import("@/app/(site)/wow-forever/actions");
    const data = new FormData(); data.set("groupId", "group-a"); data.set("nominationId", "one");
    await voteWarcraftGuild({}, data);
    mocks.hub = structuredClone(mocks.save.mock.calls[0][0]); mocks.save.mockClear();
    data.set("nominationId", "two"); await voteWarcraftGuild({}, data);
    expect(mocks.save.mock.calls[0][0].groups[0].guild.votes).toEqual({ "chip-id": "one", "member-id": "two" });
    mocks.save.mockClear(); data.set("nominationId", "b-one");
    expect((await voteWarcraftGuild({}, data)).error).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects outsiders even if they are admins", async () => {
    const { nominateWarcraftGuild, voteWarcraftGuild } = await import("@/app/(site)/wow-forever/actions");
    mocks.admin = true; mocks.owner = undefined;
    const data = new FormData(); data.set("groupId", "group-a"); data.set("guildName", "Outsider Guild"); data.set("nominationId", "one");
    expect((await nominateWarcraftGuild({}, data)).error).toBeTruthy();
    expect((await voteWarcraftGuild({}, data)).error).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

describe("Dungeon completion permissions", () => {
  function check(player = "Larry", groupId = "group-a", completed = "true") {
    const data = new FormData();
    data.set("player", player);
    data.set("groupId", groupId);
    data.set("dungeonId", "hall-of-thanes");
    data.set("completed", completed);
    return data;
  }
  beforeEach(() => {
    mocks.hub.groups = [
      { id: "group-a", members: { "member-id": "Larry" }, players: structuredClone(mocks.hub.players), nights: [], dungeonCompletions: { "hall-of-thanes": ["Chip"] } },
      { id: "group-b", members: {}, players: structuredClone(mocks.hub.players), nights: [] },
    ];
  });
  it("lets an owner set and clear their check, preserving other players and parties", async () => {
    expect((await updateWarcraftDungeon({}, check())).success).toBeTruthy();
    const saved = mocks.save.mock.calls[0][0];
    expect(saved.groups[0].dungeonCompletions["hall-of-thanes"]).toEqual(["Chip", "Larry"]);
    expect(saved.groups[1]).toEqual(mocks.hub.groups[1]);
    mocks.hub = saved;
    await updateWarcraftDungeon({}, check());
    expect(mocks.save.mock.calls[1][0].groups[0].dungeonCompletions["hall-of-thanes"]).toEqual(["Chip", "Larry"]);
    await updateWarcraftDungeon({}, check("Larry", "group-a", "false"));
    expect(mocks.save.mock.calls[2][0].groups[0].dungeonCompletions["hall-of-thanes"]).toEqual(["Chip"]);
  });
  it("rejects other players, other parties, blocked and uninvited accounts", async () => {
    expect((await updateWarcraftDungeon({}, check("Chip"))).error).toBeTruthy();
    expect((await updateWarcraftDungeon({}, check("Larry", "group-b"))).error).toBeTruthy();
    mocks.blocked = true;
    expect((await updateWarcraftDungeon({}, check())).error).toBeTruthy();
    mocks.blocked = false;
    mocks.owner = undefined;
    expect((await updateWarcraftDungeon({}, check())).error).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("lets admins update any visible player but rejects invalid targets", async () => {
    mocks.admin = true;
    mocks.owner = undefined;
    expect((await updateWarcraftDungeon({}, check("Chip", "group-b"))).success).toBeTruthy();
    expect(mocks.save.mock.calls[0][0].groups[1].dungeonCompletions["hall-of-thanes"]).toEqual(["Chip"]);
    mocks.save.mockClear();
    expect((await updateWarcraftDungeon({}, check("Unknown"))).error).toBeTruthy();
    const invalid = check(); invalid.set("dungeonId", "unknown");
    expect((await updateWarcraftDungeon({}, invalid)).error).toBeTruthy();
    expect((await updateWarcraftDungeon({}, check("Larry", "group-a", "invalid"))).error).toBeTruthy();
    mocks.hub.groups[0].players[0].hidden = true;
    expect((await updateWarcraftDungeon({}, check())).error).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
