"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  lockPage,
  unlockPage,
  setPageSourceUrl,
  setManagedSourceUrl,
} from "@/lib/autoManagedPagesData";
import { refreshManagedPage } from "@/lib/managedPageRefresh";

function refreshMessageFromError(error: unknown) {
  const message = error instanceof Error ? error.message : "Refresh failed.";
  return message.replace(/\s+/g, " ").trim().slice(0, 300);
}

export async function lockPageAction(path: string, label: string) {
  lockPage(path, label);
  revalidatePath(path);
  revalidatePath("/admin/source-managed");
}

export async function unlockPageAction(path: string) {
  unlockPage(path);
  revalidatePath(path);
  revalidatePath("/admin/source-managed");
}

export async function setSourceUrlAction(formData: FormData) {
  const path = formData.get("path") as string;
  const url = (formData.get("url") as string).trim();
  setPageSourceUrl(path, url);
  revalidatePath(path);
  revalidatePath("/admin/source-managed");
}

export async function setManagedSourceUrlAction(formData: FormData) {
  const path = formData.get("path") as string;
  const sourceKey = formData.get("sourceKey") as string;
  const url = (formData.get("url") as string).trim();
  setManagedSourceUrl(path, sourceKey, url);
  revalidatePath(path);
  revalidatePath("/admin/source-managed");
}

export async function refreshPageAction(path: string) {
  let status = "refreshed";
  let message = "Refreshed the page cache.";

  try {
    const result = await refreshManagedPage(path);
    message = result.message;
  } catch (error) {
    status = "refresh-failed";
    message = refreshMessageFromError(error);
  }

  revalidatePath(path);
  revalidatePath("/admin/source-managed");
  redirect(
    `/admin/source-managed?status=${status}&path=${encodeURIComponent(path)}&message=${encodeURIComponent(message)}`,
  );
}
