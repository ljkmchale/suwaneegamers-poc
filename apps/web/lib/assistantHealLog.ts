import fs from "node:fs";
import { contentPath } from "@/lib/contentFiles";

// A rolling log of what Myra healed herself, so "what have you fixed lately?" is
// answerable and nobody has to watch the queue. Written by the nightly learn job
// after each unattended apply; read into her admin self-learning report. This is
// a pull digest (she tells an admin on request, and it shows in /admin) — there
// is deliberately no outbound email/push.

export interface HealLogEntry {
  healedAt: string;
  kind: string;
  question: string;
}

interface HealLog {
  entries: HealLogEntry[];
  updatedAt: string;
}

const FILE = "assistant-heal-log.json";
const MAX_ENTRIES = 200;

export function readHealLog(): HealLog {
  try {
    const parsed = JSON.parse(fs.readFileSync(contentPath(FILE), "utf8")) as Partial<HealLog>;
    return {
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.filter(
            (e): e is HealLogEntry =>
              Boolean(e) && typeof e.healedAt === "string" && typeof e.question === "string",
          )
        : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return { entries: [], updatedAt: "" };
  }
}

/** Append newly-healed items (newest first), capped so the file stays small. */
export function appendHealLog(items: Array<{ kind: string; question: string }>, at = new Date().toISOString()): void {
  if (items.length === 0) return;
  const log = readHealLog();
  const fresh: HealLogEntry[] = items.map((item) => ({ healedAt: at, kind: item.kind, question: item.question }));
  const next: HealLog = {
    entries: [...fresh, ...log.entries].slice(0, MAX_ENTRIES),
    updatedAt: at,
  };
  const target = contentPath(FILE);
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  fs.renameSync(temp, target);
}

/** The most recent heals, for the digest Myra reports to admins. */
export function getRecentHeals(limit = 8): HealLogEntry[] {
  return readHealLog().entries.slice(0, limit);
}

/** How many heals landed in the last `days` days. */
export function healsSince(days: number, now = Date.now()): number {
  const cutoff = now - days * 86_400_000;
  return readHealLog().entries.filter((e) => {
    const t = Date.parse(e.healedAt);
    return !Number.isNaN(t) && t >= cutoff;
  }).length;
}
