"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getUserSession } from "@/lib/userSession";
import { blockMember, unblockMember } from "@/lib/memberBlocks";
import { resolveMemberUnblockRequest } from "@/lib/memberUnblockRequests";

export async function blockMemberAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) throw new Error("An email address is required to block a member.");
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const adminSession = await getUserSession();
  blockMember({ email, displayName, reason, createdBy: adminSession.email ?? null });
  revalidatePath("/admin/members");
}

export async function unblockMemberAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) throw new Error("An email address is required to unblock a member.");
  const adminSession = await getUserSession();
  unblockMember(email);
  resolveMemberUnblockRequest(email, "approved", adminSession.email ?? null);
  revalidatePath("/admin/members");
}

export async function declineMemberUnblockRequestAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) throw new Error("An email address is required to close a review request.");
  const adminSession = await getUserSession();
  resolveMemberUnblockRequest(email, "declined", adminSession.email ?? null);
  revalidatePath("/admin/members");
}
