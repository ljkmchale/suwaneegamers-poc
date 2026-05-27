import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminSession";

export async function requireAdmin(redirectTo = "/admin/login") {
  const session = await getAdminSession();

  if (session.isAdmin !== true) {
    redirect(redirectTo);
  }

  return session;
}
