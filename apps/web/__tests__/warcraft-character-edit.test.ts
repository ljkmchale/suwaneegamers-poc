// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
const mocks = vi.hoisted(() => ({ admin: false, owner: "Larry" as string | undefined, save: vi.fn(), write: vi.fn(), hub: {} as any }));
vi.mock("@/lib/adminSession", () => ({ getAdminSession: async () => ({ isAdmin: mocks.admin }) }));
vi.mock("@/lib/userSession", () => ({ getUserSession: async () => ({ email: "member@example.com" }) }));
vi.mock("@/lib/warcraftInvitations", () => ({ getWarcraftPlayerName: () => mocks.owner }));
vi.mock("@/lib/memberBlocks", () => ({ isMemberBlocked: () => false }));
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/wowForever", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/wowForever")>(), getWarcraftHub: () => structuredClone(mocks.hub), saveWarcraftHub: mocks.save }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, default: actual, mkdir: vi.fn(), writeFile: mocks.write };
});
import { updateWarcraftCharacter, addWarcraftNight, deleteWarcraftNight } from "@/app/(site)/wow-forever/actions";

function form(player: string) { const data = new FormData(); data.set("player", player); data.set("character", "Arcane friend"); data.set("className", "Mage"); data.set("level", "12"); return data; }
beforeEach(() => {
  mocks.admin = false; mocks.owner = "Larry"; mocks.save.mockClear(); mocks.write.mockClear();
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
    expect((await updateWarcraftCharacter({}, form("Larry"))).success).toBeTruthy();
    const saved = mocks.save.mock.calls[0][0];
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
