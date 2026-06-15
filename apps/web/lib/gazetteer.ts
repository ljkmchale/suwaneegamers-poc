import { getDb } from "@/lib/db";

export interface GazetteerEntry {
  id: string;
  title: string;
  slug: string;
  docUrl: string;
}

interface DbGazetteerRow {
  id: string;
  title: string;
  slug: string;
  doc_url: string;
}

export function getGazetteerEntries(): GazetteerEntry[] {
  return (getDb().prepare(`SELECT * FROM gazetteer ORDER BY title`).all() as DbGazetteerRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    docUrl: row.doc_url,
  }));
}
