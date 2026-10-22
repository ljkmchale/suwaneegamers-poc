"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getWarcraftHub, saveWarcraftHub } from "@/lib/wowForever";
import { isWarcraftDate } from "@/lib/warcraftDates";
import { getAdminSession } from "@/lib/adminSession";
import { getUserSession } from "@/lib/userSession";
import { getWarcraftPlayerName } from "@/lib/warcraftInvitations";
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
  if (!admin && (!user.email || isMemberBlocked(user.email) || getWarcraftPlayerName(user.email) !== playerName)) {
    return { error: "You can only edit your own character." };
  }
  if (!getWarcraftHub().players.some(player => player.name === playerName)) return { error: "Player not found." };
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
  const player = hub.players.find(player => player.name === playerName);
  if (!player) return { error: "Player not found." };
  Object.assign(player, { character, className, level });
  if (image) player.image = image;
  else if (data.get("removeImage") === "on") delete player.image;
  saveWarcraftHub(hub);
  revalidatePath("/wow-forever");
  return { success: "Character saved." };
}

export async function updateWarcraftHub(data: FormData) {
  await requireAdmin();
  const hub = getWarcraftHub();
  const nextNight = field(data, "nextNight");
  if (nextNight && !isWarcraftDate(nextNight)) throw new Error("Choose a valid game-night date.");
  hub.nextNight = nextNight || "First game night to be decided";
  for (const key of ["schedule", "realm", "faction", "objective"] as const) {
    const value = field(data, key, 1000);
    if (value) hub[key] = value;
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
  hub.nights.unshift({ id: crypto.randomUUID(), date, title, notes });
  hub.nights.sort((a, b) => b.date.localeCompare(a.date));
  saveWarcraftHub(hub);
  revalidatePath("/wow-forever");
  revalidatePath("/wow-forever/chronicles");
}

export async function deleteWarcraftNight(data: FormData) {
  await requireAdmin();
  const hub = getWarcraftHub();
  hub.nights = hub.nights.filter(night => night.id !== field(data, "id"));
  saveWarcraftHub(hub);
  revalidatePath("/wow-forever");
  revalidatePath("/wow-forever/chronicles");
}
