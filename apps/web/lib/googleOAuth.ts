import "server-only";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CALLBACK_PATH = "/api/auth/google/callback";

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

/**
 * Sign-in is only enforced once real Google credentials exist. This keeps the
 * site (and local dev) usable before the OAuth client is configured, and avoids
 * ever locking everyone out behind a button that cannot work.
 */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Resolve the externally-visible base URL for building redirect URIs. The
 * redirect URI must match exactly between the login redirect, the token
 * exchange, and what is registered in the Google Cloud console — so prefer an
 * explicit override, then proxy headers (production sits behind Cloudflare),
 * then the request origin.
 */
export function getBaseUrl(request: Request): string {
  const override = process.env.OAUTH_BASE_URL;
  if (override) return override.replace(/\/$/, "");

  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host");
  if (forwardedHost) {
    const proto = headers.get("x-forwarded-proto")
      ?? (forwardedHost.startsWith("localhost") || forwardedHost.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export function getRedirectUri(request: Request): string {
  return `${getBaseUrl(request)}${CALLBACK_PATH}`;
}

/** Build the Google consent-screen URL to redirect the visitor to. */
export function buildAuthUrl(options: { redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: options.state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchange the authorization code for tokens and read the identity out of the
 * returned id_token. The id_token comes straight from Google's token endpoint
 * over TLS, authenticated with our client secret, so its payload is trusted
 * without a separate signature check.
 */
export async function exchangeCodeForIdentity(options: {
  code: string;
  redirectUri: string;
}): Promise<GoogleIdentity> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
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

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google token exchange failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("Google token response missing id_token");

  const claims = decodeJwtPayload(tokens.id_token);
  if (!claims.sub || !claims.email) throw new Error("Google id_token missing required claims");

  return {
    sub: String(claims.sub),
    email: String(claims.email),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: typeof claims.name === "string" && claims.name ? claims.name : String(claims.email),
    picture: typeof claims.picture === "string" ? claims.picture : undefined,
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const segment = token.split(".")[1];
  if (!segment) throw new Error("Malformed id_token");
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(base64, "base64").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}
