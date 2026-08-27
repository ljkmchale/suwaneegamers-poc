import type { LibraryBook } from "./LibraryExperience";

export function uniqueBooks(books: LibraryBook[]): LibraryBook[] {
  const merged = new Map<string, LibraryBook>();
  for (const book of books) {
    const section = book.collection === "Chronicles Archive" || book.collection === "Campaign Chronicles" ? "adventure" : "world";
    const key = `${section}:${normalizeTitle(book.title)}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, book);
      continue;
    }

    // The first record is the curated campaign, deity, or Gazetteer volume.
    // Preserve its complete text and real artwork while attaching every
    // matching archive source so the reader can append the source material.
    const allSourcePaths = [...new Set([
      existing.sourcePath,
      ...(existing.sourcePaths ?? []),
      book.sourcePath,
      ...(book.sourcePaths ?? []),
    ].filter((sourcePath): sourcePath is string => Boolean(sourcePath)))];
    const sourcePath = existing.sourcePath ?? allSourcePaths[0];
    merged.set(key, {
      ...book,
      ...existing,
      sourcePath,
      sourcePaths: allSourcePaths.filter((candidate) => candidate !== sourcePath),
    });
  }
  return [...merged.values()];
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
