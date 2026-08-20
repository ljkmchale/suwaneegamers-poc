"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { blockIp, isBlockableSourceIp, unblockIp } from "@/lib/cloudflareSecurity";
import { clientIpFromHeaders } from "@/lib/securityLog";

function requestedIp(formData: FormData): string {
  const ip = String(formData.get("ip") ?? "").trim();
  if (!isBlockableSourceIp(ip)) throw new Error("A valid, non-shared public IP address is required.");
  return ip;
}

export async function blockIpAction(formData: FormData) {
  await requireAdmin();
  const ip = requestedIp(formData);
  const adminIp = clientIpFromHeaders(await headers());
  if (adminIp === ip) throw new Error("Refusing to block the IP used by your current admin session.");
  await blockIp(ip, { source: "manual", reason: "Blocked manually from the Security admin page" });
  revalidatePath("/admin/security");
}

export async function unblockIpAction(formData: FormData) {
  await requireAdmin();
  await unblockIp(requestedIp(formData));
  revalidatePath("/admin/security");
}
