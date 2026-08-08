"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { updateFeedbackStatus, type FeedbackStatus } from "@/lib/voiceFeedback";

const ALLOWED: readonly FeedbackStatus[] = ["new", "reviewed", "done", "dismissed"];

export async function setFeedbackStatusAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "") as FeedbackStatus;
  if (!Number.isInteger(id) || !ALLOWED.includes(status)) return;
  updateFeedbackStatus(id, status);
  revalidatePath("/admin/feedback");
}
