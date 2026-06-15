"use server";

import { revalidatePath } from "next/cache";
import {
  lockPage,
  unlockPage,
  setPageSourceUrl,
  setManagedSourceUrl,
} from "@/lib/autoManagedPagesData";

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
  revalidatePath(path);
}
