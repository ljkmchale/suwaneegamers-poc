import fs from "fs";
import path from "path";
import type { LibraryBook } from "./LibraryExperience";

const SESSION_ART_DIRECTORIES: Record<string, string> = {
  "dungeons iii": "dungeons-iii",
  hoe: "heroes-of-emberstran",
  sod: "souls-of-destiny",
};

export function findSessionArtwork(title: string, campaign: string): string | undefined {
  const sessionMatch = title.match(/\bsession\s+(\d{1,2})\b/i);
  const directory = SESSION_ART_DIRECTORIES[campaign.toLowerCase()];
  if (!sessionMatch || !directory) return undefined;

  const sessionNumber = sessionMatch[1].padStart(2, "0");
  const diskDirectory = path.join(process.cwd(), "media", "images", "chronicles", directory);
  try {
    const fileName = fs.readdirSync(diskDirectory)
      .sort()
      .find((candidate) => candidate.startsWith(`session-${sessionNumber}-`) && /\.(?:avif|jpe?g|png|webp)$/i.test(candidate));
    return fileName ? `/media/images/chronicles/${directory}/${fileName}` : undefined;
  } catch {
    return undefined;
  }
}

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
