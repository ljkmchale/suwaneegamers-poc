import { getDb } from "@/lib/db";

export interface Organization {
  id: string;
  name: string;
  knownFor: string | null;
  summary: string | null;
  details: string | null;
  description: string | null;
  image: string | null;
  href: string | null;
  faction: boolean;
}

interface DbOrgRow {
  id: string;
  name: string;
  known_for: string | null;
  summary: string | null;
  details: string | null;
  description: string | null;
  image: string | null;
  href: string | null;
  faction: number;
}

export function getOrganizations(): Organization[] {
  return (getDb().prepare(`SELECT * FROM organizations ORDER BY rowid`).all() as DbOrgRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    knownFor: row.known_for,
    summary: row.summary,
    details: row.details,
    description: row.description,
    image: row.image,
    href: row.href,
    faction: Boolean(row.faction),
  }));
}
