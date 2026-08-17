import { getDb } from "@/lib/db";
import { readContent } from "@/lib/contentFiles";

export type SearchResultType =
  | "territory"
  | "organization"
  | "campaign"
  | "session"
  | "dm"
  | "player"
  | "gazetteer"
  | "creature"
  | "deity"
  | "page";

const SITE_PAGES: { path: string; label: string }[] = [
  { path: "/", label: "Home" },
  { path: "/campaigns", label: "Campaigns" },
  { path: "/campaign-journeys", label: "Myrdae in Motion" },
  { path: "/players", label: "Players" },
  { path: "/dungeon-masters", label: "Dungeon Masters" },
  { path: "/bestiary", label: "Bestiary" },
  { path: "/lore", label: "Legends & Lore" },
  { path: "/world", label: "World" },
  { path: "/setting", label: "Setting" },
  { path: "/history", label: "History" },
  { path: "/pantheon", label: "Pantheon" },
  { path: "/gazetteer", label: "Gazetteer" },
  { path: "/campaign-setting", label: "Campaign Setting" },
  { path: "/organizations", label: "Organizations" },
  { path: "/adventures", label: "Adventures" },
  { path: "/reference-for-dungeon-masters", label: "Reference for DMs" },
  { path: "/territories", label: "Territories" },
  { path: "/calendar", label: "Calendar" },
  { path: "/advents_of_harmony", label: "Advents of Harmony" },
  { path: "/maps-of-myrdae", label: "Maps of Myrdae" },
  { path: "/previous-campaigns", label: "Previous Campaigns" },
];

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
type DbGazetteer = { id: string; title: string; doc_url: string; region: string | null };

function safeFts(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((w) => w.length >= 2)
    .map((w) => w + "*")
    .join(" ");
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function boundedLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  let prev = Array.from({ length: bl + 1 }, (_, i) => i);
  let curr = new Array<number>(bl + 1);
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

// A visitor spelling an invented place name by ear rarely nails it — the logged
// failures are people typing "Gava"/"Gavel" hunting for "Gevakaln", getting
// nothing because LIKE needs a literal substring. Compare the query against the
// same-length start of each name and tolerate a few edits, so a plausible
// mis-hearing still surfaces the entry. Guarded to 3+ chars so short prefixes
// (already matched broadly by LIKE) don't flood the palette with near-misses.
export function fuzzyNameMatch(query: string, name: string): boolean {
  const q = normalizeName(query);
  const n = normalizeName(name);
  if (q.length < 3 || !n) return false;
  if (n.includes(q)) return true;
  const threshold = q.length <= 4 ? 1 : Math.floor(q.length / 3);
  return boundedLevenshtein(q, n.slice(0, q.length)) <= threshold;
}

export function search(query: string): SearchResult[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const db = getDb();
  const like = `%${q}%`;
  const results: SearchResult[] = [];

  // ── Site pages ──
  const ql = q.toLowerCase();
  const matchingPages = SITE_PAGES.filter((p) =>
    p.label.toLowerCase().includes(ql) || p.path.includes(ql),
  );
  for (const p of matchingPages) {
    results.push({
      id: `page-${p.path}`,
      type: "page",
      title: p.label,
      category: "Pages",
      href: p.path,
    });
  }
  // Custom pages from DB
  const customPages = db
    .prepare(`SELECT id, slug, title FROM custom_pages WHERE status = 'active'`)
    .all() as { id: string; slug: string; title: string }[];
  for (const p of customPages) {
    if (p.title.toLowerCase().includes(ql) || p.slug.toLowerCase().includes(ql)) {
      results.push({
        id: `page-custom-${p.id}`,
        type: "page",
        title: p.title,
        category: "Pages",
        href: `/${p.slug}`,
      });
    }
  }

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
  // Search the lore body and region too, not just the title: someone typing a
  // sea, ruler, or region name should reach the city it belongs to.
  const GAZ_LIMIT = 5;
  const gaz = db
    .prepare(
      `SELECT id, title, doc_url, region FROM gazetteer
       WHERE title LIKE ? OR description LIKE ? OR region LIKE ?
       ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END, title
       LIMIT ?`,
    )
    .all(like, like, like, `${q}%`, GAZ_LIMIT) as DbGazetteer[];
  const gazSeen = new Set(gaz.map((g) => g.id));
  const gazMatches = [...gaz];
  // Fuzzy fallback for mis-heard names, only when the exact pass left room.
  if (gazMatches.length < GAZ_LIMIT && q.length >= 3) {
    const allGaz = db
      .prepare(`SELECT id, title, doc_url, region FROM gazetteer`)
      .all() as DbGazetteer[];
    for (const g of allGaz) {
      if (gazSeen.has(g.id)) continue;
      if (fuzzyNameMatch(q, g.title)) {
        gazMatches.push(g);
        gazSeen.add(g.id);
        if (gazMatches.length >= GAZ_LIMIT) break;
      }
    }
  }
  for (const g of gazMatches) {
    results.push({
      id: `gaz-${g.id}`,
      type: "gazetteer",
      title: g.title,
      subtitle: g.region ?? "City Lore",
      category: "Gazetteer",
      href: g.doc_url,
      external: true,
    });
  }

  // ── Bestiary (DB) ──
  const bestiary = db
    .prepare(`SELECT id, name, type, href FROM bestiary WHERE name LIKE ? OR type LIKE ? ORDER BY name`)
    .all(like, like) as { id: string; name: string; type: string; href: string | null }[];
  for (const b of bestiary) {
    results.push({
      id: `creature-${b.id}`,
      type: "creature",
      title: b.name,
      subtitle: b.type,
      category: "Bestiary",
      href: b.href ?? "/bestiary",
      external: !!b.href,
    });
  }

  // ── Pantheon (layout JSON — deity-card blocks) ──
  try {
    const pantheonLayout = readContent<{ kind: string; type: string; id: string; props: Record<string, unknown> }[]>("page-layouts/pantheon.json");
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
