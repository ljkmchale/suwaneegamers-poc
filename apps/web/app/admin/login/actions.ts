"use server";

import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminSession";

export async function loginAction(formData: FormData) {
  const password = formData.get("password") as string;
  const from = (formData.get("from") as string) || "/admin";

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    redirect(`/admin/login?error=1&from=${encodeURIComponent(from)}`);
  }

  const session = await getAdminSession();
  session.isAdmin = true;
  await session.save();

  redirect(from);
}

export async function logoutAction() {
  const session = await getAdminSession();
  session.destroy();
  redirect("/admin/login");
}
