// Shared rules for "where do we send someone after sign-in". No server-only
// imports: this is used by the proxy, the sign-in page, and the OAuth routes.

/** Cookie carrying the pre-sign-in destination across the Google round trip. */
export const RETURN_TO_COOKIE = "sg-oauth-from";

/**
 * Reduce an arbitrary return path to one that is safe to redirect to.
 *
 * Only same-site absolute paths are allowed. A protocol-relative value like
 * "//evil.example" is a full URL to the browser, so it is rejected along with
 * anything that is not rooted at "/", which is what stops this from becoming an
 * open redirect.
 */
export function safeReturnPath(value: string | null | undefined, fallback = "/"): string {
  const path = String(value ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  // Never bounce someone back to the sign-in page or an API endpoint.
  if (path === "/signin" || path.startsWith("/signin?") || path.startsWith("/api/")) return fallback;
  return path;
}
