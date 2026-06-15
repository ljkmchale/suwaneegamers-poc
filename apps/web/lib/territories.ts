import { getDb } from "@/lib/db";

export interface Territory {
  id: string;
  name: string;
  capital: string | null;
  region: string;
  description: string;
  image: string | null;
  href: string | null;
}

interface DbTerritoryRow {
  id: string;
  name: string;
  capital: string | null;
  region: string;
  description: string;
  image: string | null;
  href: string | null;
}

export function getTerritories(): Territory[] {
  return getDb().prepare(`SELECT * FROM territories ORDER BY rowid`).all() as DbTerritoryRow[];
}
