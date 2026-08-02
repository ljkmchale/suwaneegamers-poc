import { timingSafeEqual } from "node:crypto";
import { getAdminSession } from "@/lib/adminSession";

export async function mayReadDetailedHealth(request: Request): Promise<boolean> {
  const session = await getAdminSession();
  if (session.isAdmin === true) return true;
  const expected = process.env.MYRA_INTERNAL_API_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isHealthAdmin(): Promise<boolean> {
  return (await getAdminSession()).isAdmin === true;
}
