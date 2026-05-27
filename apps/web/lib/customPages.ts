import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type PageStatus = "active" | "archived" | "deleted";

export interface CustomPage {
  id: string;
  slug: string;        // no leading slash — "about", "new-players", "rules/overview"
  title: string;
  status: PageStatus;
  createdAt: string;   // ISO date string
}

function pagesPath() {
  return path.join(process.cwd(), "../../content/pages.json");
}

export function getAllCustomPages(): CustomPage[] {
  try {
    return JSON.parse(fs.readFileSync(pagesPath(), "utf-8")) as CustomPage[];
  } catch {
    return [];
  }
}

export function getActiveCustomPages(): CustomPage[] {
  return getAllCustomPages().filter((p) => p.status === "active");
}

/** Looks up a page by its full URL slug (with or without leading slash). */
export function getCustomPage(slug: string): CustomPage | undefined {
  const key = slug.replace(/^\//, "");
  return getAllCustomPages().find((p) => p.slug === key);
}

export function createCustomPage(title: string, slug: string): CustomPage {
  const pages = getAllCustomPages();
  const page: CustomPage = {
    id: randomUUID(),
    slug: slug.replace(/^\//, "").trim(),
    title: title.trim(),
    status: "active",
    createdAt: new Date().toISOString().split("T")[0],
  };
  pages.push(page);
  writePages(pages);
  return page;
}

export function updateCustomPage(
  id: string,
  updates: Partial<Pick<CustomPage, "title" | "slug" | "status">>
): void {
  const pages = getAllCustomPages();
  const idx = pages.findIndex((p) => p.id === id);
  if (idx === -1) return;
  pages[idx] = { ...pages[idx], ...updates };
  writePages(pages);
}

function writePages(pages: CustomPage[]) {
  fs.writeFileSync(pagesPath(), JSON.stringify(pages, null, 2) + "\n", "utf-8");
}

/** Converts a page title to a URL-safe slug. */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
