import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignInGate } from "@/components/auth/SignInGate";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { safeReturnPath } from "@/lib/authRedirect";
import { isDiscordAuthConfigured } from "@/lib/discordOAuth";
import { isMemberBlocked } from "@/lib/memberBlocks";
import {
  MEMBER_BLOCK_REVIEW_COOKIE,
  readMemberBlockReviewToken,
} from "@/lib/memberBlockReviewIdentity";
import { getMemberUnblockRequest } from "@/lib/memberUnblockRequests";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in with Google or Discord to enter Suwanee Gamers.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// The destination the proxy sends signed-out visitors to. It lives outside the
// (site) route group on purpose: that group's layout renders the gate itself,
// and a gated page as the gate's destination would be a redirect loop.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; review?: string }>;
}) {
  const { from, review } = await searchParams;
  const target = safeReturnPath(from);

  // Already signed in (a stale bookmark, or a second tab): go straight through.
  if (isSignedIn(await getUserSession())) redirect(target);

  const cookieStore = await cookies();
  const authError = cookieStore.get("sg-auth-error")?.value;
  const reviewEmail = await readMemberBlockReviewToken(
    cookieStore.get(MEMBER_BLOCK_REVIEW_COOKIE)?.value,
  );
  const blockedReviewAvailable = Boolean(reviewEmail && isMemberBlocked(reviewEmail));
  const reviewStatus = reviewEmail ? getMemberUnblockRequest(reviewEmail)?.status : undefined;

  return (
    <SignInGate
      error={blockedReviewAvailable ? "blocked" : authError}
      returnTo={target}
      discordEnabled={isDiscordAuthConfigured()}
      blockedReviewAvailable={blockedReviewAvailable}
      reviewPending={reviewStatus === "pending" || review === "requested"}
      reviewDeclined={reviewStatus === "declined"}
      reviewUnavailable={review === "unavailable"}
    />
  );
}
