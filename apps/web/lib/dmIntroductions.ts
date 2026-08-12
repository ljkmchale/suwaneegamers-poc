import { readContent } from "./contentFiles";

export interface DmIntroduction {
  dmId: string;
  name: string;
  image: string;
  audio: string;
  transcript: string;
}

export function getDmIntroduction(name: string | undefined): DmIntroduction | undefined {
  if (!name) return undefined;

  try {
    const introductions = readContent<DmIntroduction[]>("dm-introductions.json");
    return introductions.find(
      (entry) => entry.name.localeCompare(name, undefined, { sensitivity: "base" }) === 0,
    );
  } catch {
    return undefined;
  }
}
