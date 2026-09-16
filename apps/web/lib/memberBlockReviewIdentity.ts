import "server-only";

import { sealData, unsealData } from "iron-session";
import { USER_SESSION_OPTIONS } from "@/lib/userSession";

export const MEMBER_BLOCK_REVIEW_COOKIE = "sg-block-review";
export const MEMBER_BLOCK_REVIEW_TTL_SECONDS = 60 * 60;

interface MemberBlockReviewIdentity {
  email: string;
  purpose: "member-unblock-review";
}

const password = USER_SESSION_OPTIONS.password as string;

/** Create a short-lived, tamper-resistant proof of the blocked OAuth identity. */
export async function createMemberBlockReviewToken(email: string): Promise<string> {
  return sealData(
    { email: email.trim().toLowerCase(), purpose: "member-unblock-review" },
    { password, ttl: MEMBER_BLOCK_REVIEW_TTL_SECONDS },
  );
}

/** Read the verified identity carried from the rejected session/sign-in. */
export async function readMemberBlockReviewToken(token?: string): Promise<string | null> {
  if (!token) return null;
  try {
    const identity = await unsealData<MemberBlockReviewIdentity>(token, { password });
    if (identity.purpose !== "member-unblock-review" || !identity.email) return null;
    return identity.email.trim().toLowerCase();
  } catch {
    return null;
  }
}
