import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";

export type WebsiteUpdateKind = "content" | "image" | "file";

export interface WebsiteUpdateItem {
  kind: WebsiteUpdateKind;
  name: string;
  updatedAt: string;
}

export interface WebsiteUpdateSnapshot {
  checkedAt: string;
  timezone: string;
  updatedToday: boolean;
  todayCount: number;
  latestUpdate: WebsiteUpdateItem | null;
  updatesToday: WebsiteUpdateItem[];
  categories: Record<WebsiteUpdateKind, {
    todayCount: number;
    latestUpdate: WebsiteUpdateItem | null;
    updatesToday: WebsiteUpdateItem[];
  }>;
}

interface ContentRow {
  path: string;
  updated_at: string;
}

const MAX_TODAY_ITEMS = 20;

function localDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function walkFiles(root: string, kind: WebsiteUpdateKind, prefix: string): WebsiteUpdateItem[] {
  if (!fs.existsSync(root)) return [];
  const items: WebsiteUpdateItem[] = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolute);
      } else if (entry.isFile()) {
        items.push({
          kind,
          name: `${prefix}/${path.relative(root, absolute).replaceAll("\\", "/")}`,
          updatedAt: fs.statSync(absolute).mtime.toISOString(),
        });
      }
    }
  }
  return items;
}

export function buildWebsiteUpdateSnapshot(
  items: WebsiteUpdateItem[],
  now = new Date(),
  timezone = "America/New_York",
): WebsiteUpdateSnapshot {
  // DB-backed content also has a JSON mirror. Treat those as one update and
  // retain whichever timestamp is newest.
  const newestByItem = new Map<string, WebsiteUpdateItem>();
  for (const item of items) {
    if (Number.isNaN(Date.parse(item.updatedAt))) continue;
    const key = `${item.kind}:${item.name.replace(/^content\//, "")}`;
    const current = newestByItem.get(key);
    if (!current || Date.parse(item.updatedAt) > Date.parse(current.updatedAt)) {
      newestByItem.set(key, item);
    }
  }
  const valid = [...newestByItem.values()]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const todayKey = localDateKey(now, timezone);
  const today = valid.filter(
    (item) => localDateKey(new Date(item.updatedAt), timezone) === todayKey,
  );
  const categories = Object.fromEntries(
    (["content", "image", "file"] as WebsiteUpdateKind[]).map((kind) => {
      const matching = valid.filter((item) => item.kind === kind);
      const matchingToday = today.filter((item) => item.kind === kind);
      return [kind, {
        todayCount: matchingToday.length,
        latestUpdate: matching[0] ?? null,
        updatesToday: matchingToday.slice(0, 5),
      }];
    }),
  ) as WebsiteUpdateSnapshot["categories"];
  return {
    checkedAt: now.toISOString(),
    timezone,
    updatedToday: today.length > 0,
    todayCount: today.length,
    latestUpdate: valid[0] ?? null,
    updatesToday: today.slice(0, MAX_TODAY_ITEMS),
    categories,
  };
}

/** Current website freshness facts, gathered when a Myra session starts. */
export function getWebsiteUpdates(
  timezone = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_TIMEZONE ?? "America/New_York",
): WebsiteUpdateSnapshot {
  const webRoot = process.cwd();
  const repoRoot = path.resolve(webRoot, "../..");
  let content: WebsiteUpdateItem[] = [];
  try {
    const rows = getDb()
      .prepare("SELECT path, updated_at FROM content_documents ORDER BY updated_at DESC")
      .all() as ContentRow[];
    content = rows.map((row) => ({
      kind: "content",
      name: row.path,
      updatedAt: row.updated_at,
    }));
  } catch {
    // A missing database should not prevent Myra from starting; filesystem
    // timestamps still provide image and application-file freshness.
  }

  const images = walkFiles(path.join(webRoot, "media/images"), "image", "/media/images");
  const websiteFiles = ["app", "components", "lib"].flatMap((folder) =>
    walkFiles(path.join(webRoot, folder), "file", `apps/web/${folder}`),
  );
  // Include editable content mirrors if the database is unavailable or a sync
  // has not yet copied a just-written file into content_documents.
  const contentFiles = walkFiles(path.join(repoRoot, "content"), "content", "content")
    .filter((item) => !path.basename(item.name).startsWith("suwaneegamers.db"));

  return buildWebsiteUpdateSnapshot([...content, ...images, ...websiteFiles, ...contentFiles], new Date(), timezone);
}
