"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getWarcraftHub, saveWarcraftHub } from "@/lib/wowForever";
import { isWarcraftDate } from "@/lib/warcraftDates";

function field(data: FormData, key: string, max = 300) {
  return String(data.get(key) ?? "").trim().slice(0, max);
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
  hub.players = hub.players.map((player, index) => ({
    ...player,
    character: field(data, `character-${index}`, 80),
    className: field(data, `class-${index}`, 80) || "Undecided",
    level: field(data, `level-${index}`, 20),
  }));
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
