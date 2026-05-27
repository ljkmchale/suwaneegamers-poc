import fs from "fs";
import path from "path";
import { PAGE_SECTIONS } from "./pageSections";

type PageLayouts = Record<string, string[]>;

function layoutPath() {
  return path.join(process.cwd(), "../../content/page-layouts.json");
}

export function getAllPageLayouts(): PageLayouts {
  try {
    return JSON.parse(fs.readFileSync(layoutPath(), "utf-8")) as PageLayouts;
  } catch {
    return {};
  }
}

/** Returns the stored section order for a page, falling back to default order. */
export function getPageLayout(pageId: string): string[] {
  const all = getAllPageLayouts();
  if (all[pageId]?.length) return all[pageId];
  return (PAGE_SECTIONS[pageId] ?? []).map((s) => s.id);
}

export function setPageLayout(pageId: string, sectionIds: string[]): void {
  const all = getAllPageLayouts();
  all[pageId] = sectionIds;
  fs.writeFileSync(layoutPath(), JSON.stringify(all, null, 2) + "\n", "utf-8");
}
