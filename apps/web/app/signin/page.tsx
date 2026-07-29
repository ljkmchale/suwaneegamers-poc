import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignInGate } from "@/components/auth/SignInGate";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { safeReturnPath } from "@/lib/authRedirect";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in with Google to enter Suwanee Gamers.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// The destination the proxy sends signed-out visitors to. It lives outside the
// (site) route group on purpose: that group's layout renders the gate itself,
// and a gated page as the gate's destination would be a redirect loop.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const target = safeReturnPath(from);

  // Already signed in (a stale bookmark, or a second tab): go straight through.
  if (isSignedIn(await getUserSession())) redirect(target);

  const authError = (await cookies()).get("sg-auth-error")?.value;
  return <SignInGate error={authError} returnTo={target} />;
}
