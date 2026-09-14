import "server-only";
import { getOAuthBaseUrl } from "@/lib/oauthShared";

const DISCORD_AUTH_ENDPOINT = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_ENDPOINT = "https://discord.com/api/oauth2/token";
const DISCORD_USER_ENDPOINT = "https://discord.com/api/users/@me";
const CALLBACK_PATH = "/api/auth/discord/callback";

export interface DiscordIdentity {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatar?: string;
}

/**
 * Sign-in is only enforced once real Discord credentials exist, matching
 * Google — see lib/googleOAuth.ts.
 */
export function isDiscordAuthConfigured(): boolean {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

export function getRedirectUri(request: Request): string {
  return `${getOAuthBaseUrl(request)}${CALLBACK_PATH}`;
}

/** Build the Discord consent-screen URL to redirect the visitor to. */
export function buildAuthUrl(options: { redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: "identify email",
    state: options.state,
    prompt: "consent",
  });
  return `${DISCORD_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchange the authorization code for an access token, then fetch the
 * identity from /users/@me. Discord's token endpoint only accepts
 * application/x-www-form-urlencoded and expects the client credentials as
 * HTTP Basic auth.
 */
export async function exchangeCodeForIdentity(options: {
  code: string;
  redirectUri: string;
}): Promise<DiscordIdentity> {
  const clientId = process.env.DISCORD_CLIENT_ID ?? "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenResponse = await fetch(DISCORD_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      code: options.code,
      redirect_uri: options.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => "");
    throw new Error(`Discord token exchange failed (${tokenResponse.status}): ${detail.slice(0, 300)}`);
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error("Discord token response missing access_token");

  const userResponse = await fetch(DISCORD_USER_ENDPOINT, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userResponse.ok) {
    const detail = await userResponse.text().catch(() => "");
    throw new Error(`Discord identity fetch failed (${userResponse.status}): ${detail.slice(0, 300)}`);
  }

  const user = (await userResponse.json()) as {
    id?: string;
    username?: string;
    global_name?: string | null;
    email?: string;
    verified?: boolean;
    avatar?: string | null;
  };
  if (!user.id || !user.email) throw new Error("Discord identity response missing required fields");

  return {
    id: user.id,
    email: user.email,
    emailVerified: user.verified === true,
    name: user.global_name || user.username || user.email,
    avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
  };
}
