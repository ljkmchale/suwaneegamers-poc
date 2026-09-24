import fs from "fs";
import path from "path";
import { contentDir, readContent, writeContent } from "@/lib/contentFiles";
import { clampCatalog, type ServiceCatalog } from "@/lib/serviceCosts";

const FILE = "service-costs.json";

/** DB-first read of the services tracker. Never throws. */
export function getServiceCatalog(): ServiceCatalog {
  try {
    return clampCatalog(readContent<unknown>(FILE));
  } catch {
    return { services: [] };
  }
}

export function saveServiceCatalog(catalog: ServiceCatalog): void {
  writeContent(FILE, clampCatalog(catalog));
}

// Keys are split across processes: the web server loads apps/web/.env.local,
// while the voice agent and sync scripts read the repo-root and service env
// files. Scan all of them for NAMES with a non-empty value — values are never
// returned.
const ENV_FILES = [".env.local", "apps/web/.env.local", "services/livekit-schedule-agent/.env.local"];

function envNamesWithValues(): Set<string> {
  const names = new Set(Object.keys(process.env).filter((key) => process.env[key]?.trim()));
  const repoRoot = path.dirname(contentDir());
  for (const file of ENV_FILES) {
    try {
      for (const line of fs.readFileSync(path.join(repoRoot, file), "utf-8").split(/\r?\n/)) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
        if (match && match[2].trim()) names.add(match[1]);
      }
    } catch {
      // Missing env file on this machine — skip it.
    }
  }
  return names;
}

/** Which of each service's env vars are set somewhere (booleans only). */
export function configuredKeyMap(services: { envKeys: string[] }[]): Map<string, boolean> {
  const present = envNamesWithValues();
  const map = new Map<string, boolean>();
  for (const service of services) {
    for (const key of service.envKeys) map.set(key, present.has(key));
  }
  return map;
}
