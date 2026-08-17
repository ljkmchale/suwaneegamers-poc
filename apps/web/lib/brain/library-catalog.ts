import fs from "node:fs/promises";
import path from "node:path";
import { brainConfig } from "./config";
import type { PageEntry } from "./vector-store";

type LibraryCatalog = {
  version: number;
  createdAt: string;
  pages: Array<Pick<PageEntry, "path" | "title" | "campaign" | "visibility">>;
};

let cachedCatalog: LibraryCatalog | null = null;
let cachedMtime = 0;

export async function loadLibraryCatalog(): Promise<LibraryCatalog> {
  const catalogPath = path.join(path.dirname(brainConfig.indexPath), "library-catalog.json");
  const stat = await fs.stat(catalogPath);
  if (cachedCatalog && cachedMtime === stat.mtimeMs) return cachedCatalog;
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8")) as LibraryCatalog;
  cachedCatalog = catalog;
  cachedMtime = stat.mtimeMs;
  return catalog;
}
