"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { deleteReview, setReviewCensored } from "@/lib/adventsGuide";

export async function censorGuideReviewAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const censored = String(formData.get("censored") ?? "") === "1";
  setReviewCensored(id, censored);
  revalidatePath("/admin/advents-guide");
}

export async function deleteGuideReviewAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  deleteReview(id);
  revalidatePath("/admin/advents-guide");
}
