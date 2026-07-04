import { getDb } from "@/lib/db";

export interface GazetteerEntry {
  id: string;
  title: string;
  slug: string;
  docUrl: string;
  folderUrl: string | null;
  referenceUrl: string | null;
  imageUrl: string | null;
  imageSourceFileId: string | null;
  imageSourceFileName: string | null;
  size: string;
  region: string;
  description: string;
}

interface DbGazetteerRow {
  id: string;
  title: string;
  slug: string;
  doc_url: string;
  folder_url: string | null;
  reference_url: string | null;
  image_url: string | null;
  image_source_file_id: string | null;
  image_source_file_name: string | null;
  size: string | null;
  region: string | null;
  description: string | null;
}

export function getGazetteerEntries(): GazetteerEntry[] {
  return (
    getDb()
      .prepare(
        `SELECT
          id,
          title,
          slug,
          doc_url,
          folder_url,
          reference_url,
          image_url,
          image_source_file_id,
          image_source_file_name,
          size,
          region,
          description
        FROM gazetteer
        ORDER BY title`,
      )
      .all() as DbGazetteerRow[]
  ).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    docUrl: row.doc_url,
    folderUrl: row.folder_url,
    referenceUrl: row.reference_url,
    imageUrl: row.image_url,
    imageSourceFileId: row.image_source_file_id,
    imageSourceFileName: row.image_source_file_name,
    size: row.size ?? "",
    region: row.region ?? "",
    description: row.description ?? "",
  }));
}
