import { createHash } from "node:crypto";
import { getActiveCampaigns } from "@/lib/campaigns";
import { getDb } from "@/lib/db";
import { getPlayerProfiles } from "@/lib/players";
import type { UserSessionData } from "@/lib/userSession";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  playerName?: string;
  myraEnabled: boolean;
  /** Explicitly chosen persona id, by the member or an admin. Empty = auto. */
  myraPersona?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface UserProfileContext {
  profile: UserProfile;
  games: string[];
  characters: string[];
  /** True when this member runs at least one active campaign as DM. */
  isDm: boolean;
  favoriteLocations: FavoriteSiteLocation[];
}

export interface FavoriteSiteLocation {
  path: string;
  label: string;
  visits: number;
}

export function favoriteLocationLabel(path: string): string {
  if (path === "/") return "Home";
  return path
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/-/g, " "))
    .map((part) => part.replace(/\b\w/g, (letter) => letter.toUpperCase()))
    .join(" · ");
}

export function rankFavoriteLocations(
  rows: Array<{ path: string; visits: number }>,
): FavoriteSiteLocation[] {
  return rows
    .filter(({ path }) => path.startsWith("/") && !path.startsWith("/admin") && path !== "/profile")
    .slice(0, 5)
    .map(({ path, visits }) => ({ path, visits, label: favoriteLocationLabel(path) }));
}

interface UserProfileRow {
  id: string;
  email: string;
  display_name: string;
  player_name: string | null;
  myra_enabled: number;
  myra_persona: string | null;
  created_at: string;
  last_seen_at: string;
}

function profileId(session: UserSessionData): string {
  const identity = session.sub ?? session.email?.toLowerCase() ?? "unknown";
  return createHash("sha256").update(identity).digest("hex").slice(0, 24);
}

function mapProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    playerName: row.player_name ?? undefined,
    myraEnabled: row.myra_enabled === 1,
    myraPersona: row.myra_persona ?? undefined,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function getOrCreateUserProfile(session: UserSessionData): {
  profile: UserProfile;
  isNew: boolean;
} {
  if (!session.email) throw new Error("A signed-in email is required.");
  const db = getDb();
  const id = profileId(session);
  const existing = db
    .prepare(`SELECT * FROM user_profiles WHERE id = ? OR email = ? LIMIT 1`)
    .get(id, session.email.toLowerCase()) as UserProfileRow | undefined;
  const now = new Date().toISOString();

  if (existing) {
    const rosterMatch = getPlayerProfiles().find(
      (player) =>
        player.name.localeCompare(
          session.name ?? existing.display_name,
          undefined,
          { sensitivity: "base" },
        ) === 0,
    );
    db.prepare(
      `UPDATE user_profiles
       SET google_sub = ?, email = ?, display_name = ?, player_name = ?, last_seen_at = ?
       WHERE id = ?`,
    ).run(
      session.sub ?? null,
      session.email.toLowerCase(),
      session.name ?? existing.display_name,
      rosterMatch?.name ?? existing.player_name,
      now,
      existing.id,
    );
    return {
      profile: mapProfile({
        ...existing,
        email: session.email.toLowerCase(),
        display_name: session.name ?? existing.display_name,
        player_name: rosterMatch?.name ?? existing.player_name,
        last_seen_at: now,
      }),
      isNew: false,
    };
  }

  const displayName = session.name ?? session.email;
  const rosterMatch = getPlayerProfiles().find(
    (player) => player.name.localeCompare(displayName, undefined, { sensitivity: "base" }) === 0,
  );
  db.prepare(
    `INSERT INTO user_profiles
      (id, google_sub, email, display_name, player_name, created_at, updated_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    session.sub ?? null,
    session.email.toLowerCase(),
    displayName,
    rosterMatch?.name ?? null,
    now,
    now,
    now,
  );
  return {
    profile: {
      id,
      email: session.email.toLowerCase(),
      displayName,
      playerName: rosterMatch?.name,
      myraEnabled: true,
      createdAt: now,
      lastSeenAt: now,
    },
    isNew: true,
  };
}

// Persona ids are slugs (see lib/assistantPersonas.ts). Anything else is treated
// as "no explicit choice", which falls back to roster matching then the default.
function normalizePersonaId(value: string | null | undefined): string | null {
  const id = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,47}$/.test(id) ? id : null;
}

export function updateUserProfile(
  session: UserSessionData,
  input: { myraEnabled: boolean; myraPersona?: string | null },
): UserProfile {
  const { profile } = getOrCreateUserProfile(session);
  const now = new Date().toISOString();
  // undefined means "leave the persona alone"; null/"" clears it back to auto.
  const persona =
    input.myraPersona === undefined ? profile.myraPersona ?? null : normalizePersonaId(input.myraPersona);

  getDb().prepare(
    `UPDATE user_profiles
     SET myra_enabled = ?, myra_persona = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.myraEnabled ? 1 : 0,
    persona,
    now,
    profile.id,
  );
  return {
    ...profile,
    myraEnabled: input.myraEnabled,
    myraPersona: persona ?? undefined,
  };
}

/** Admin-side persona assignment, keyed by profile id rather than session. */
export function setUserProfilePersona(profileId: string, personaId: string | null): void {
  getDb().prepare(
    `UPDATE user_profiles SET myra_persona = ?, updated_at = ? WHERE id = ?`,
  ).run(normalizePersonaId(personaId), new Date().toISOString(), profileId);
}

/** Every signed-in member, most recently seen first (admin panel). */
export function listUserProfiles(): UserProfile[] {
  const rows = getDb().prepare(
    `SELECT * FROM user_profiles ORDER BY last_seen_at DESC`,
  ).all() as UserProfileRow[];
  return rows.map(mapProfile);
}

function getFavoriteSiteLocations(email: string): FavoriteSiteLocation[] {
  const rows = getDb().prepare(
    `SELECT e.path, COUNT(*) AS visits
     FROM analytics_events e
     JOIN analytics_sessions s ON s.session_id = e.session_id
     WHERE lower(s.visitor_email) = lower(?)
       AND e.event_type = 'page_view'
       AND e.path NOT LIKE '/admin%'
       AND e.path <> '/profile'
     GROUP BY e.path
     ORDER BY visits DESC, MAX(e.created_at) DESC
     LIMIT 5`,
  ).all(email) as Array<{ path: string; visits: number }>;
  return rankFavoriteLocations(rows);
}

export function getUserProfileContext(session: UserSessionData): UserProfileContext {
  const { profile } = getOrCreateUserProfile(session);
  const assignments = profile.playerName
    ? getPlayerProfiles().find((player) => player.name === profile.playerName)?.assignments ?? []
    : [];
  const games = [...new Set(assignments.map(({ campaign }) => campaign.name))];
  const characters = [...new Set(assignments.map(({ character }) => character.name))];

  // Include games they run as a DM, even when they are not listed in the party.
  let isDm = false;
  if (profile.playerName) {
    for (const campaign of getActiveCampaigns()) {
      if (
        campaign.dm
          .split(/\s*&\s*/)
          .some((dm) => dm.localeCompare(profile.playerName!, undefined, { sensitivity: "base" }) === 0)
      ) {
        games.push(campaign.name);
        isDm = true;
      }
    }
  }

  return {
    profile,
    games: [...new Set(games)],
    characters,
    isDm,
    favoriteLocations: getFavoriteSiteLocations(profile.email),
  };
}
