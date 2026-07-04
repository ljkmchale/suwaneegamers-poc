import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";

export type PageStatus = "active" | "archived" | "deleted";

export interface CustomPage {
  id: string;
  slug: string;        // no leading slash — "about", "new-players", "rules/overview"
  title: string;
  status: PageStatus;
  createdAt: string;   // ISO date string
}

type DbRow = { id: string; slug: string; title: string; status: string; created_at: string };

function mapRow(row: DbRow): CustomPage {
  return { id: row.id, slug: row.slug, title: row.title, status: row.status as PageStatus, createdAt: row.created_at };
}

export function getAllCustomPages(): CustomPage[] {
  return (
    getDb()
      .prepare(`SELECT id, slug, title, status, created_at FROM custom_pages ORDER BY created_at`)
      .all() as DbRow[]
  ).map(mapRow);
}

export function getActiveCustomPages(): CustomPage[] {
  return (
    getDb()
      .prepare(`SELECT id, slug, title, status, created_at FROM custom_pages WHERE status = 'active' ORDER BY created_at`)
      .all() as DbRow[]
  ).map(mapRow);
}

/** Looks up a page by its full URL slug (with or without leading slash). */
export function getCustomPage(slug: string): CustomPage | undefined {
  const key = slug.replace(/^\//, "");
  const row = getDb()
    .prepare(`SELECT id, slug, title, status, created_at FROM custom_pages WHERE slug = ?`)
    .get(key) as DbRow | undefined;
  return row ? mapRow(row) : undefined;
}

export function createCustomPage(title: string, slug: string): CustomPage {
  const page: CustomPage = {
    id: randomUUID(),
    slug: slug.replace(/^\//, "").trim(),
    title: title.trim(),
    status: "active",
    createdAt: new Date().toISOString().split("T")[0],
  };
  getDb()
    .prepare(`INSERT INTO custom_pages (id, slug, title, status, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(page.id, page.slug, page.title, page.status, page.createdAt);
  return page;
}

export function updateCustomPage(
  id: string,
  updates: Partial<Pick<CustomPage, "title" | "slug" | "status">>,
): void {
  const db = getDb();
  if (updates.title !== undefined) db.prepare(`UPDATE custom_pages SET title = ? WHERE id = ?`).run(updates.title, id);
  if (updates.slug !== undefined) db.prepare(`UPDATE custom_pages SET slug = ? WHERE id = ?`).run(updates.slug, id);
  if (updates.status !== undefined) db.prepare(`UPDATE custom_pages SET status = ? WHERE id = ?`).run(updates.status, id);
}

/** Converts a page title to a URL-safe slug. */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
