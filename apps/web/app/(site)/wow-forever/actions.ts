"use server";

import { warcraftDungeons } from "@/lib/warcraftDungeons";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getWarcraftHub, saveWarcraftHub, warcraftGroups } from "@/lib/wowForever";
import { getAdminSession } from "@/lib/adminSession";
import { getUserSession } from "@/lib/userSession";
import { getWarcraftPlayerName, getWarcraftProfileId } from "@/lib/warcraftInvitations";
import { isMemberBlocked } from "@/lib/memberBlocks";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

function field(data: FormData, key: string, max = 300) {
  return String(data.get(key) ?? "").trim().slice(0, max);
}

export type CharacterSaveState = { error?: string; success?: string };

export async function updateWarcraftCharacter(_previous: CharacterSaveState, data: FormData): Promise<CharacterSaveState> {
  const admin = (await getAdminSession()).isAdmin === true;
  const user = await getUserSession();
  const playerName = field(data, "player", 80);
  const groupId = field(data, "groupId") || "group-a";
  if (!admin && (!user.email || isMemberBlocked(user.email) || getWarcraftPlayerName(user.email, groupId) !== playerName)) {
    return { error: "You can only edit your own character." };
  }
  if (!warcraftGroups(getWarcraftHub()).find(group => group.id === groupId)?.players.some(player => player.name === playerName)) return { error: "Player not found." };
  const character = field(data, "character", 80);
  const className = field(data, "className", 80) || "Undecided";
  const level = field(data, "level", 10);
  if (level && (!/^\d{1,3}$/.test(level) || Number(level) < 1)) return { error: "Enter a whole-number level between 1 and 999, or leave it blank." };
  let image: string | undefined;
  const upload = data.get("image");
  if (upload instanceof File && upload.size > 0) {
    if (upload.size > 5 * 1024 * 1024) return { error: "Choose an image smaller than 5 MB." };
    try {
      const input = Buffer.from(await upload.arrayBuffer());
      const decoder = sharp(input, { limitInputPixels: 25000000 });
      const metadata = await decoder.metadata();
      if (!["jpeg", "png", "webp", "avif"].includes(metadata.format ?? "")) return { error: "Choose a PNG, JPG, WebP, or AVIF image." };
      const output = await decoder.rotate().resize(768, 768, { fit: "cover", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
      const filename = `${crypto.randomUUID()}.webp`;
      const directory = path.join(process.cwd(), "media", "images", "wow-forever", "characters");
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, filename), output);
      image = `/media/images/wow-forever/characters/${filename}`;
    } catch {
      return { error: "That image could not be processed. Try a smaller PNG or JPG." };
    }
  }
  // Re-read after processing the image so another player's recent edit is retained.
  const hub = getWarcraftHub();
  hub.groups = warcraftGroups(hub);
  const player = hub.groups.find(group => group.id === groupId)?.players.find(player => player.name === playerName);
  if (!player) return { error: "Player not found." };
  Object.assign(player, { character, className, level });
  if (data.has("race")) player.race = field(data, "race", 80);
  if (data.has("specialization")) player.specialization = field(data, "specialization", 160);
  if (data.has("professions")) player.professions = field(data, "professions", 160);
  if (data.has("professionRanks")) player.professionRanks = field(data, "professionRanks", 500);
  if (image) player.image = image;
  else if (data.get("removeImage") === "on") delete player.image;
  saveWarcraftHub(hub);
  revalidatePath("/wow-forever");
  return { success: "Character saved." };
}

export async function updateWarcraftHub(data: FormData) {
  await requireAdmin();
  const hub = getWarcraftHub();
  for (const key of ["realm", "faction"] as const) {
    const value = field(data, key, 1000);
    if (value) hub[key] = value;
  }
  if (data.has("objective")) {
    const objective = field(data, "objective", 1000);
    const groupId = field(data, "groupId");
    if (groupId) {
      hub.groups = warcraftGroups(hub);
      const group = hub.groups.find(item => item.id === groupId);
      if (!group) throw new Error("Group not found.");
      group.objective = objective;
    } else if (objective) hub.objective = objective;
  }
  saveWarcraftHub(hub);
  revalidatePath("/wow-forever");
  revalidatePath("/wow-forever/chronicles");
}

export async function addWarcraftNight(data: FormData) {
  await requireAdmin();
  const date = field(data, "date", 10);
  const title = field(data, "title", 150);
  const notes = field(data, "notes", 6000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title || !notes) return;
  const hub = getWarcraftHub();
  hub.groups = warcraftGroups(hub);
  const group = hub.groups.find(group => group.id === field(data, "groupId"));
  if (!group) throw new Error("Group not found.");
  group.nights.unshift({ id: crypto.randomUUID(), date, title, notes });
  group.nights.sort((a, b) => b.date.localeCompare(a.date));
  saveWarcraftHub(hub);
  revalidatePath("/wow-forever");
  revalidatePath("/wow-forever/chronicles");
}

export async function deleteWarcraftNight(data: FormData) {
  await requireAdmin();
  const hub = getWarcraftHub();
  hub.groups = warcraftGroups(hub);
  const group = hub.groups.find(group => group.id === field(data, "groupId"));
  if (!group) throw new Error("Group not found.");
  group.nights = group.nights.filter(night => night.id !== field(data, "id"));
  saveWarcraftHub(hub);
  revalidatePath("/wow-forever");
  revalidatePath("/wow-forever/chronicles");
}

export async function configureWarcraftGroup(data: FormData) {
  await requireAdmin();
  const name = field(data, "name", 80);
  const discordUrl = field(data, "discordUrl", 300);
  const partyName = field(data, "partyName", 80);
  if (!name || (discordUrl && !/^https:\/\/discord\.com\/channels\/\d+\/\d+$/.test(discordUrl))) throw new Error("Enter a group name and a Discord channel URL.");
  const { getDb } = await import("@/lib/db");
  const members: Record<string, string> = {};
  const names = new Set<string>();
  for (const line of field(data, "members", 10000).split(/\r?\n/).filter(line => line.trim())) {
    const [email, playerName] = line.split("|").map(value => value.trim());
    const profile = getDb().prepare("SELECT id FROM user_profiles WHERE lower(email) = ?").get(email?.toLowerCase()) as { id: string } | undefined;
    if (!profile || !playerName || names.has(playerName) || members[profile.id]) throw new Error("Use one registered email | unique player name per line.");
    members[profile.id] = playerName;
    names.add(playerName);
  }
  const hub = getWarcraftHub();
  hub.groups = warcraftGroups(hub);
  const id = field(data, "groupId");
  const existing = id ? hub.groups.find(group => group.id === id) : undefined;
  if (id && !existing) throw new Error("Group not found.");
  const players = Object.values(members).map(name => existing?.players.find(player => player.name === name) ?? { name, character: "", className: "Undecided", level: "" });
  if (existing) Object.assign(existing, { name, partyName, discordUrl, members, players });
  else hub.groups.push({ id: crypto.randomUUID(), name, partyName, discordUrl, members, players, nights: [] });
  saveWarcraftHub(hub);
  revalidatePath("/", "layout");
}


export type GuildSaveState = { error?: string; success?: string };

async function guildMember(data: FormData) {
  const user = await getUserSession();
  const profileId = getWarcraftProfileId(user.email);
  const hub = getWarcraftHub();
  hub.groups ??= warcraftGroups(hub);
  const group = hub.groups.find(item => item.id === field(data, "groupId"));
  if (!user.email || isMemberBlocked(user.email) || !profileId || !group?.members[profileId]) {
    return { error: "Only members of this party can nominate or vote." } as const;
  }
  return { hub, group, profileId };
}

export async function nominateWarcraftGuild(_previous: GuildSaveState, data: FormData): Promise<GuildSaveState> {
  const context = await guildMember(data);
  if ("error" in context) return { error: context.error };
  const name = String(data.get("guildName") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { error: "Enter a guild name between 2 and 80 characters." };
  const { hub, group, profileId } = context;
  group.guild ??= { nominations: [], votes: {} };
  if (group.guild.nominations.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return { error: "That name is already nominated. You can vote for it below." };
  if (group.guild.nominations.length >= 50) return { error: "This party already has 50 nominated names." };
  group.guild.nominations.push({ id: crypto.randomUUID(), name, nominatedBy: profileId });
  saveWarcraftHub(hub);
  revalidatePath("/wow-forever");
  return { success: "Guild name nominated." };
}

export async function voteWarcraftGuild(_previous: GuildSaveState, data: FormData): Promise<GuildSaveState> {
  const context = await guildMember(data);
  if ("error" in context) return { error: context.error };
  const { hub, group, profileId } = context;
  const nominationId = field(data, "nominationId", 80);
  if (!group.guild?.nominations.some(item => item.id === nominationId)) return { error: "Choose one of this party's nominated names." };
  group.guild.votes[profileId] = nominationId;
  saveWarcraftHub(hub);
  revalidatePath("/wow-forever");
  return { success: "Your vote is saved. You can change it anytime." };
}

export async function updateWarcraftDungeon(_previous: CharacterSaveState, data: FormData): Promise<CharacterSaveState> {
  const admin = (await getAdminSession()).isAdmin === true;
  const user = await getUserSession();
  const profileId = getWarcraftProfileId(user.email);
  const groupId = field(data, "groupId", 80);
  const playerName = field(data, "player", 80);
  const dungeonId = field(data, "dungeonId", 80);
  const completed = data.get("completed");
  if (!warcraftDungeons.some(dungeon => dungeon.id === dungeonId) || !["true", "false"].includes(String(completed))) {
    return { error: "Choose a dungeon and completion status." };
  }
  // Read after all asynchronous session lookups so each write retains other recent checks.
  const hub = getWarcraftHub();
  hub.groups ??= warcraftGroups(hub);
  const group = hub.groups.find(group => group.id === groupId);
  if (!admin && (!user.email || isMemberBlocked(user.email) || !profileId || group?.members[profileId] !== playerName)) {
    return { error: "You can only update your own dungeon checks." };
  }
  if (!group?.players.some(player => player.name === playerName && !player.hidden)) return { error: "Player not found." };
  group.dungeonCompletions ??= {};
  const players = new Set(group.dungeonCompletions[dungeonId] ?? []);
  if (completed === "true") players.add(playerName);
  else players.delete(playerName);
  group.dungeonCompletions[dungeonId] = [...players];
  saveWarcraftHub(hub);
  revalidatePath("/wow-forever");
  return { success: "Dungeon progress saved." };
}
