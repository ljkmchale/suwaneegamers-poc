"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readContent, writeContent } from "@/lib/contentFiles";

interface Creature { name: string; type: string; image: string; href?: string; }

function slugifyName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function saveCreatureAction(formData: FormData) {
  const creatures = readContent<Creature[]>("bestiary.json");
  const originalName = (formData.get("originalName") as string)?.trim();
  const updated: Creature = {
    name: (formData.get("name") as string).trim(),
    type: (formData.get("type") as string).trim(),
    image: (formData.get("image") as string).trim(),
    href: (formData.get("href") as string)?.trim() || undefined,
  };

  const idx = creatures.findIndex((c) => c.name === originalName);
  if (idx >= 0) {
    creatures[idx] = updated;
  } else {
    creatures.push(updated);
  }

  writeContent("bestiary.json", creatures);
  revalidatePath("/bestiary");
  redirect("/admin/bestiary");
}

export async function deleteCreatureAction(formData: FormData) {
  const name = formData.get("name") as string;
  const creatures = readContent<Creature[]>("bestiary.json");
  writeContent("bestiary.json", creatures.filter((c) => c.name !== name));
  revalidatePath("/bestiary");
  redirect("/admin/bestiary");
}

export async function reorderCreaturesAction(names: string[]) {
  const creatures = readContent<Creature[]>("bestiary.json");
  const ordered = names
    .map((n) => creatures.find((c) => c.name === n))
    .filter(Boolean) as Creature[];
  writeContent("bestiary.json", ordered);
  revalidatePath("/bestiary");
}

export { slugifyName };
