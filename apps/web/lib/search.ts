import fs from "fs";
import { getDb } from "@/lib/db";
import { contentPath } from "@/lib/contentFiles";

export type SearchResultType =
  | "territory"
  | "organization"
  | "campaign"
  | "session"
  | "dm"
  | "player"
  | "gazetteer"
  | "creature"
  | "deity";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  category: string;
  href: string;
  external?: boolean;
}

type DbTerritory = { id: string; name: string; region: string; href: string | null };
type DbOrg = { id: string; name: string; known_for: string | null };
type DbCampaign = { id: string; name: string; dm: string };
type DbSession = { id: number; campaign_id: string; title: string; campaign_name: string };
type DbDm = { id: string; name: string; focus: string };
type DbPlayer = { id: string; name: string };
type DbGazetteer = { id: string; title: string; doc_url: string };

function safeFts(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((w) => w.length >= 2)
    .map((w) => w + "*")
    .join(" ");
}

export function search(query: string): SearchResult[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const db = getDb();
  const like = `%${q}%`;
  const results: SearchResult[] = [];

  // ── Territories ──
  const territories = db
    .prepare(
      `SELECT id, name, region, href FROM territories
       WHERE name LIKE ? OR description LIKE ? OR capital LIKE ?
       ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name
       LIMIT 4`,
    )
    .all(like, like, like, `${q}%`) as DbTerritory[];
  for (const t of territories) {
    results.push({
      id: `territory-${t.id}`,
      type: "territory",
      title: t.name,
      subtitle: t.region,
      category: "Territories",
      href: t.href ?? "/territories",
      external: !!t.href,
    });
  }

  // ── Organizations ──
  const orgs = db
    .prepare(
      `SELECT id, name, known_for FROM organizations
       WHERE name LIKE ? OR known_for LIKE ? OR summary LIKE ?
       ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name
       LIMIT 4`,
    )
    .all(like, like, like, `${q}%`) as DbOrg[];
  for (const o of orgs) {
    results.push({
      id: `org-${o.id}`,
      type: "organization",
      title: o.name,
      subtitle: o.known_for ?? undefined,
      category: "Organizations",
      href: "/organizations",
    });
  }

  // ── Campaigns ──
  const campaigns = db
    .prepare(
      `SELECT id, name, dm FROM campaigns
       WHERE name LIKE ? OR description LIKE ?
       ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name
       LIMIT 3`,
    )
    .all(like, like, `${q}%`) as DbCampaign[];
  for (const c of campaigns) {
    results.push({
      id: `campaign-${c.id}`,
      type: "campaign",
      title: c.name,
      subtitle: `DM: ${c.dm}`,
      category: "Campaigns",
      href: `/campaigns/${c.id}`,
    });
  }

  // ── Session summaries (FTS5) ──
  const ftsQ = safeFts(q);
  let sessions: DbSession[] = [];
  if (ftsQ) {
    try {
      sessions = db
        .prepare(
          `SELECT ss.id, ss.campaign_id, ss.title, c.name AS campaign_name
           FROM session_summaries_fts fts
           JOIN session_summaries ss ON ss.id = fts.rowid
           JOIN campaigns c ON c.id = ss.campaign_id
           WHERE session_summaries_fts MATCH ?
           ORDER BY rank
           LIMIT 5`,
        )
        .all(ftsQ) as DbSession[];
    } catch {
      // FTS5 syntax error — fall back to LIKE
    }
  }
  if (!sessions.length) {
    sessions = db
      .prepare(
        `SELECT ss.id, ss.campaign_id, ss.title, c.name AS campaign_name
         FROM session_summaries ss
         JOIN campaigns c ON c.id = ss.campaign_id
         WHERE ss.title LIKE ? OR ss.summary LIKE ?
         LIMIT 5`,
      )
      .all(like, like) as DbSession[];
  }
  for (const s of sessions) {
    results.push({
      id: `session-${s.id}`,
      type: "session",
      title: s.title,
      subtitle: s.campaign_name,
      category: "Session Logs",
      href: `/campaigns/${s.campaign_id}`,
    });
  }

  // ── Dungeon Masters ──
  const dms = db
    .prepare(
      `SELECT id, name, focus FROM dungeon_masters
       WHERE name LIKE ? OR focus LIKE ?
       ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name
       LIMIT 3`,
    )
    .all(like, like, `${q}%`) as DbDm[];
  for (const d of dms) {
    results.push({
      id: `dm-${d.id}`,
      type: "dm",
      title: d.name,
      subtitle: d.focus,
      category: "Dungeon Masters",
      href: "/dungeon-masters",
    });
  }

  // ── Players ──
  const players = db
    .prepare(`SELECT id, name FROM players WHERE name LIKE ? ORDER BY name LIMIT 3`)
    .all(like) as DbPlayer[];
  for (const p of players) {
    results.push({
      id: `player-${p.id}`,
      type: "player",
      title: p.name,
      category: "Players",
      href: "/players",
    });
  }

  // ── Gazetteer ──
  const gaz = db
    .prepare(
      `SELECT id, title, doc_url FROM gazetteer
       WHERE title LIKE ?
       ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END, title
       LIMIT 4`,
    )
    .all(like, `${q}%`) as DbGazetteer[];
  for (const g of gaz) {
    results.push({
      id: `gaz-${g.id}`,
      type: "gazetteer",
      title: g.title,
      subtitle: "City Lore",
      category: "Gazetteer",
      href: g.doc_url,
      external: true,
    });
  }

  // ── Bestiary (JSON, 12 entries — filter in memory) ──
  try {
    const bestiary = JSON.parse(fs.readFileSync(contentPath("bestiary.json"), "utf-8")) as {
      name: string;
      type: string;
      href?: string;
    }[];
    const ql = q.toLowerCase();
    for (const b of bestiary) {
      if (b.name?.toLowerCase().includes(ql) || b.type?.toLowerCase().includes(ql)) {
        results.push({
          id: `creature-${b.name.replace(/\s+/g, "-").toLowerCase()}`,
          type: "creature",
          title: b.name,
          subtitle: b.type,
          category: "Bestiary",
          href: b.href ?? "/bestiary",
          external: !!b.href,
        });
      }
    }
  } catch {
    // ignore if file is missing
  }

  // ── Pantheon (layout JSON — deity-card blocks) ──
  try {
    const pantheonLayout = JSON.parse(
      fs.readFileSync(contentPath("page-layouts/pantheon.json"), "utf-8"),
    ) as { kind: string; type: string; id: string; props: Record<string, unknown> }[];
    const ql = q.toLowerCase();
    for (const item of pantheonLayout) {
      if (item.kind !== "block" || item.type !== "deity-card") continue;
      const titleVal = String(item.props?.title ?? "");
      const domain = String(item.props?.domain ?? "");
      if (titleVal.toLowerCase().includes(ql) || domain.toLowerCase().includes(ql)) {
        const namePart = titleVal.split(/\s+[—–-]\s+/)[0]?.trim() ?? titleVal;
        const hrefVal = item.props?.href ? String(item.props.href) : "/pantheon";
        results.push({
          id: `deity-${item.id}`,
          type: "deity",
          title: namePart,
          subtitle: domain || undefined,
          category: "Pantheon",
          href: hrefVal,
          external: !hrefVal.startsWith("/"),
        });
      }
    }
  } catch {
    // ignore if file is missing
  }

  return results;
}
