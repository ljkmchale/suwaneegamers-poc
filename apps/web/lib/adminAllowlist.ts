/**
 * Admin allowlist: when ADMIN_EMAILS is set, only those Google accounts may
 * log in to the admin panel (in addition to knowing the admin password).
 * Client-safe: env parsing only, no fs or server imports.
 */

export function allowedAdminEmails(env: string | undefined = process.env.ADMIN_EMAILS): string[] {
  return (env ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** True when the allowlist is configured and should be enforced. */
export function adminAllowlistActive(env: string | undefined = process.env.ADMIN_EMAILS): boolean {
  return allowedAdminEmails(env).length > 0;
}

export function isAllowedAdminEmail(
  email: string | undefined,
  env: string | undefined = process.env.ADMIN_EMAILS,
): boolean {
  const list = allowedAdminEmails(env);
  // An empty allowlist means the feature is off — allow (password still required).
  if (list.length === 0) return true;
  return typeof email === "string" && list.includes(email.trim().toLowerCase());
}
