"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isMemberBlocked } from "@/lib/memberBlocks";
import {
  MEMBER_BLOCK_REVIEW_COOKIE,
  readMemberBlockReviewToken,
} from "@/lib/memberBlockReviewIdentity";
import { requestMemberUnblock } from "@/lib/memberUnblockRequests";

export async function requestUnblockAction(formData: FormData) {
  const cookieStore = await cookies();
  const email = await readMemberBlockReviewToken(
    cookieStore.get(MEMBER_BLOCK_REVIEW_COOKIE)?.value,
  );
  if (!email || !isMemberBlocked(email)) redirect("/signin?review=unavailable");

  const message = String(formData.get("message") ?? "").trim();
  requestMemberUnblock(email, message);
  redirect("/signin?review=requested");
}
