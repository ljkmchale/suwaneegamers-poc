// Canada may reach authentication, but only these verified identities may start
// a new session there. Existing signed-in members retain worldwide access.
const CANADIAN_MEMBER_EMAILS = new Set([
  "everttdukeshire@gmail.com",
  "evelyndukeshire@gmail.com",
]);

export function isCanadianSignInPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/signin" ||
    pathname === "/api/auth/google" || pathname.startsWith("/api/auth/google/") ||
    pathname === "/api/auth/discord" || pathname.startsWith("/api/auth/discord/");
}

export function mayStartGeoSession(country: string | null, verifiedCloudflare: boolean,
  email: string, emailVerified: boolean): boolean {
  if (!verifiedCloudflare || !country || country === "US") return true;
  return country === "CA" && emailVerified &&
    CANADIAN_MEMBER_EMAILS.has(email.trim().toLowerCase());
}
