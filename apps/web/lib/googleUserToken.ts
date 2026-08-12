/**
 * Delegated Google Drive read access **as a specific user** (the site owner),
 * for the background scheduler.
 *
 * Some source docs are shared privately with a person's own Google account and
 * the owner will not share them with a service account. To read those, the site
 * acts as the user: a one-time OAuth consent (drive.readonly, offline) captures
 * a refresh token, which is stored here and exchanged for short-lived access
 * tokens whenever a job needs to read a doc. This reads anything the consenting
 * account can see.
 *
 * Flow:
 *   - /api/admin/google-drive/connect  -> consent screen (admin only)
 *   - /api/admin/google-drive/callback -> stores the refresh token (this module)
 *   - scheduler jobs call exportGoogleDocMarkdownAsUser()
 *
 * The consenting user must keep the OAuth app in "In production" publishing
 * status, otherwise Google expires the refresh token ~7 days after issue.
 */
import { getDb } from "@/lib/db";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

// Single stored credential — the site reads docs as one owner account.
const TOKEN_ID = "drive-readonly";

let accessTokenCache: { value: string; expiresAt: number } | null = null;

function ensureTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS google_oauth_tokens (
      id            TEXT PRIMARY KEY,
      refresh_token TEXT NOT NULL,
      scope         TEXT,
      account_email TEXT,
      obtained_at   TEXT NOT NULL
    );
  `);
}

export function storeRefreshToken(options: {
  refreshToken: string;
  scope?: string;
  accountEmail?: string;
}): void {
  ensureTable();
  getDb()
    .prepare(
      `INSERT INTO google_oauth_tokens (id, refresh_token, scope, account_email, obtained_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         refresh_token = excluded.refresh_token,
         scope = excluded.scope,
         account_email = excluded.account_email,
         obtained_at = excluded.obtained_at`,
    )
    .run(
      TOKEN_ID,
      options.refreshToken,
      options.scope ?? DRIVE_SCOPE,
      options.accountEmail ?? null,
      new Date().toISOString(),
    );
  accessTokenCache = null;
}

interface StoredToken {
  refresh_token: string;
  scope: string | null;
  account_email: string | null;
  obtained_at: string;
}

function readStored(): StoredToken | null {
  ensureTable();
  return (
    (getDb()
      .prepare(
        `SELECT refresh_token, scope, account_email, obtained_at
         FROM google_oauth_tokens WHERE id = ?`,
      )
      .get(TOKEN_ID) as StoredToken | undefined) ?? null
  );
}

/** Whether a Drive refresh token has been captured. */
export function isUserDriveConnected(): boolean {
  return readStored() !== null;
}

/** The account the stored token belongs to (for display), or null. */
export function connectedDriveAccount(): string | null {
  return readStored()?.account_email ?? null;
}

export function disconnectUserDrive(): void {
  ensureTable();
  getDb().prepare(`DELETE FROM google_oauth_tokens WHERE id = ?`).run(TOKEN_ID);
  accessTokenCache = null;
}

/** Build the consent URL that asks the owner for offline Drive read access. */
export function buildDriveConsentUrl(options: {
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: `openid email ${DRIVE_SCOPE}`,
    state: options.state,
    access_type: "offline",
    // Force a refresh_token even if the account has consented before.
    prompt: "consent",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchange the one-time auth code for tokens and persist the refresh token.
 * Returns the account email so the caller can show who was connected.
 */
export async function completeDriveConsent(options: {
  code: string;
  redirectUri: string;
}): Promise<{ accountEmail: string | null }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: options.code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: options.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Drive consent exchange failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const tokens = (await res.json()) as {
    refresh_token?: string;
    scope?: string;
    id_token?: string;
  };
  if (!tokens.refresh_token) {
    throw new Error(
      "Google returned no refresh_token. Ensure prompt=consent and access_type=offline, "
        + "and that a stale prior grant was revoked.",
    );
  }
  const accountEmail = tokens.id_token ? emailFromIdToken(tokens.id_token) : null;
  storeRefreshToken({
    refreshToken: tokens.refresh_token,
    scope: tokens.scope,
    accountEmail: accountEmail ?? undefined,
  });
  return { accountEmail };
}

function emailFromIdToken(idToken: string): string | null {
  try {
    const segment = idToken.split(".")[1];
    if (!segment) return null;
    const json = Buffer.from(
      segment.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const claims = JSON.parse(json) as { email?: string };
    return typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
}

/** Exchange the stored refresh token for a cached short-lived access token. */
async function getAccessToken(): Promise<string> {
  const stored = readStored();
  if (!stored) {
    throw new Error(
      "No Google Drive user token stored. Connect at /api/admin/google-drive/connect first.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (accessTokenCache && accessTokenCache.expiresAt > now + 60) {
    return accessTokenCache.value;
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: stored.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // invalid_grant here usually means the refresh token expired (app still in
    // "Testing" publishing status) or was revoked — needs a fresh consent.
    throw new Error(
      `Drive token refresh failed (${res.status}): ${detail.slice(0, 300)}. `
        + `Re-connect at /api/admin/google-drive/connect (and confirm the OAuth `
        + `app is published "In production").`,
    );
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Drive token refresh response missing access_token.");
  accessTokenCache = {
    value: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600),
  };
  return accessTokenCache.value;
}

/** Export a Google Doc as Markdown via the Drive API, acting as the owner. */
export async function exportGoogleDocMarkdownAsUser(docId: string): Promise<string> {
  const token = await getAccessToken();
  const url =
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}` +
    `/export?mimeType=${encodeURIComponent("text/markdown")}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    redirect: "follow",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const hint =
      res.status === 404
        ? ` Is the doc shared with ${connectedDriveAccount() ?? "the connected account"}?`
        : "";
    throw new Error(
      `Drive export failed for ${docId}: HTTP ${res.status}.${hint} ${detail.slice(0, 200)}`,
    );
  }
  return res.text();
}
