import { getDb } from "@/lib/db";

export interface BestiaryEntry {
  id: string;
  name: string;
  type: string;
  image: string | null;
  href: string | null;
}

export function getAllCreatures(): BestiaryEntry[] {
  return getDb()
    .prepare(`SELECT id, name, type, image, href FROM bestiary ORDER BY name`)
    .all() as BestiaryEntry[];
}

export function searchCreatures(query: string): BestiaryEntry[] {
  const like = `%${query}%`;
  return getDb()
    .prepare(`SELECT id, name, type, image, href FROM bestiary WHERE name LIKE ? OR type LIKE ? ORDER BY name`)
    .all(like, like) as BestiaryEntry[];
}
