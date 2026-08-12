// NOTE: no `import "server-only"` here — this module is imported by the
// scheduler's tsx scripts (outside the Next bundle), where that shim is
// unresolvable. It stays server-side by only ever being imported server-side.
import crypto from "crypto";
import fs from "fs";

/**
 * Delegated read access to Google Docs/Drive for the background scheduler.
 *
 * The site's user OAuth (lib/googleOAuth.ts) is identity-only ("openid email
 * profile", access_type=online) — it proves who a visitor is and keeps nothing
 * it could reuse. The scheduler runs as no one, so to read docs that are shared
 * privately (not "anyone with the link"), it authenticates as a Google service
 * account: a robot identity with its own key. Share a doc with the service
 * account's client_email (Viewer) and every job here can read it, while the doc
 * stays invisible to the public.
 *
 * Setup (one time, in Google Cloud):
 *   1. Create a service account, enable the Drive API on its project.
 *   2. Download its JSON key.
 *   3. Point GOOGLE_SERVICE_ACCOUNT_KEY_FILE at the key path (or paste the JSON
 *      into GOOGLE_SERVICE_ACCOUNT_KEY) in .env.local.
 *   4. Share each private doc with the key's client_email as Viewer.
 *
 * No key configured => isServiceAccountConfigured() is false and callers fall
 * back to the anonymous export, so nothing breaks before it is set up.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedKey: ServiceAccountKey | null | undefined;
let cachedToken: { value: string; expiresAt: number } | null = null;

function loadKey(): ServiceAccountKey | null {
  if (cachedKey !== undefined) return cachedKey;

  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  let raw: string | null = null;
  if (inline && inline.trim()) {
    raw = inline;
  } else if (file && fs.existsSync(file)) {
    raw = fs.readFileSync(file, "utf-8");
  }

  if (!raw) {
    cachedKey = null;
    return null;
  }

  const parsed = JSON.parse(raw) as Partial<ServiceAccountKey>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "Google service account key is missing client_email or private_key.",
    );
  }
  cachedKey = {
    client_email: parsed.client_email,
    // .env values often escape newlines; PEM parsing needs the real ones.
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
    token_uri: parsed.token_uri,
  };
  return cachedKey;
}

export function isServiceAccountConfigured(): boolean {
  return loadKey() !== null;
}

/** The robot's email — the address a doc must be shared with. Null if unset. */
export function serviceAccountEmail(): string | null {
  return loadKey()?.client_email ?? null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Mint (and cache) a short-lived access token by signing a JWT assertion with
 * the service account key and exchanging it — the standard two-legged OAuth
 * flow for server-to-server access. No refresh token, nothing expires on the
 * 7-day testing-mode clock; the key itself is the durable credential.
 */
async function getAccessToken(): Promise<string> {
  const key = loadKey();
  if (!key) {
    throw new Error(
      "No Google service account key configured (set GOOGLE_SERVICE_ACCOUNT_KEY_FILE).",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.value;
  }

  const aud = key.token_uri || TOKEN_ENDPOINT;
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: DRIVE_SCOPE,
      aud,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = base64url(
    crypto.createSign("RSA-SHA256").update(signingInput).sign(key.private_key),
  );
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(aud, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Service account token exchange failed (${res.status}): ${detail.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("Service account token response missing access_token.");
  }
  cachedToken = {
    value: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600),
  };
  return cachedToken.value;
}

/**
 * Export a Google Doc as Markdown using the Drive API and the service account's
 * access token. Works on privately-shared docs (as long as the doc is shared
 * with serviceAccountEmail()), unlike the anonymous docs.google.com export.
 */
export async function exportGoogleDocMarkdown(docId: string): Promise<string> {
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
        ? ` Is the doc shared with the service account (${serviceAccountEmail()})?`
        : "";
    throw new Error(
      `Drive export failed for ${docId}: HTTP ${res.status}.${hint} ${detail.slice(0, 200)}`,
    );
  }
  return res.text();
}
