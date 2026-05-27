"use server";

import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminSession";

function safeRedirectPath(from: string | null, fallback = "/admin") {
  if (!from || !from.startsWith("/")) return fallback;
  if (from.startsWith("//")) return "/admin";
  return from;
}

export async function loginAction(formData: FormData) {
  const password = formData.get("password") as string;
  const wantsEditMode = formData.get("editMode") === "1";
  const from = safeRedirectPath(formData.get("from") as string | null, wantsEditMode ? "/" : "/admin");

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    const params = new URLSearchParams({ error: "1", from });
    if (wantsEditMode) params.set("editMode", "1");
    redirect(`/admin/login?${params.toString()}`);
  }

  const session = await getAdminSession();
  session.isAdmin = true;
  session.editMode = wantsEditMode ? true : session.editMode === true;
  await session.save();

  redirect(from);
}

export async function enableEditModeAction(formData: FormData) {
  const from = safeRedirectPath(formData.get("from") as string | null, "/");
  const session = await getAdminSession();

  if (session.isAdmin !== true) {
    redirect(`/admin/login?${new URLSearchParams({ from, editMode: "1" }).toString()}`);
  }

  session.editMode = true;
  await session.save();
  redirect(from);
}

export async function disableEditModeAction(formData: FormData) {
  const from = safeRedirectPath(formData.get("from") as string | null, "/");
  const session = await getAdminSession();
  session.editMode = false;
  await session.save();
  redirect(from);
}

export async function logoutAction() {
  const session = await getAdminSession();
  session.destroy();
  redirect("/admin/login");
}
