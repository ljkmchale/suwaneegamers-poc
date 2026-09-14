import "server-only";

/**
 * Resolve the externally-visible base URL for building an OAuth redirect URI.
 * Shared by every sign-in provider so a redirect-URI mismatch — or a bug that
 * trusts the wrong host header — only has to be fixed in one place. Prefer an
 * explicit override, then proxy headers (production sits behind Cloudflare),
 * then the request origin. The redirect URI built from this must match
 * exactly between the login redirect, the token exchange, and what is
 * registered with the provider.
 */
export function getOAuthBaseUrl(request: Request): string {
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
