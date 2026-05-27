"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCustomPage,
  updateCustomPage,
  titleToSlug,
} from "@/lib/customPages";
import { requireAdmin } from "@/lib/adminAuth";

export async function createPageAction(formData: FormData) {
  await requireAdmin();

  const title = (formData.get("title") as string)?.trim();
  const rawSlug = (formData.get("slug") as string)?.trim();

  if (!title) return;

  const slug = rawSlug || titleToSlug(title);
  createCustomPage(title, slug);

  revalidatePath("/admin/pages");
  revalidatePath(`/${slug}`);
  redirect("/admin/pages");
}

export async function archivePageAction(id: string) {
  await requireAdmin();

  updateCustomPage(id, { status: "archived" });
  revalidatePath("/admin/pages");
}

export async function restorePageAction(id: string) {
  await requireAdmin();

  updateCustomPage(id, { status: "active" });
  revalidatePath("/admin/pages");
}

export async function deletePageAction(id: string) {
  await requireAdmin();

  updateCustomPage(id, { status: "deleted" });
  revalidatePath("/admin/pages");
}

export async function renamePageAction(id: string, formData: FormData) {
  await requireAdmin();

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;
  updateCustomPage(id, { title });
  revalidatePath("/admin/pages");
}
