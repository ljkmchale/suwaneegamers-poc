"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { readContent, writeContent } from "@/lib/contentFiles";
import type { PlayerProfileSeed } from "@/lib/players";

export async function savePlayerAction(formData: FormData) {
  await requireAdmin();

  const players = readContent<PlayerProfileSeed[]>("players.json");
  const updated: PlayerProfileSeed = {
    id: (formData.get("id") as string).trim(),
    name: (formData.get("name") as string).trim(),
    description: (formData.get("description") as string).trim(),
    portrait: (formData.get("portrait") as string)?.trim() || undefined,
  };

  const idx = players.findIndex((p) => p.id === updated.id);
  if (idx >= 0) {
    players[idx] = updated;
  } else {
    players.push(updated);
  }

  writeContent("players.json", players);
  revalidatePath("/players");
  redirect("/admin/players");
}

export async function deletePlayerAction(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const players = readContent<PlayerProfileSeed[]>("players.json");
  writeContent("players.json", players.filter((p) => p.id !== id));
  revalidatePath("/players");
  redirect("/admin/players");
}

export async function reorderPlayersAction(ids: string[]) {
  await requireAdmin();

  const players = readContent<PlayerProfileSeed[]>("players.json");
  const ordered = ids
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as PlayerProfileSeed[];
  writeContent("players.json", ordered);
  revalidatePath("/players");
}
