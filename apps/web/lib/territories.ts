import fs from "fs";
import { contentPath } from "@/lib/contentFiles";

export interface Territory {
  id: string;
  name: string;
  capital: string | null;
  region: string;
  description: string;
  image: string | null;
  href: string | null;
}

export function getTerritories(): Territory[] {
  const raw = fs.readFileSync(contentPath("territories.json"), "utf-8");
  return JSON.parse(raw) as Territory[];
}
