import fs from "fs";
import { contentPath } from "@/lib/contentFiles";

export interface Organization {
  id: string;
  name: string;
  knownFor: string | null;
  summary: string | null;
  details: string | null;
  description: string | null;
  image: string | null;
  href: string | null;
  faction: boolean;
}

export function getOrganizations(): Organization[] {
  const raw = fs.readFileSync(contentPath("organizations.json"), "utf-8");
  return JSON.parse(raw) as Organization[];
}
