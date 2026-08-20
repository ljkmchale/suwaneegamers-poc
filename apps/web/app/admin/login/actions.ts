"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAdminSession } from "@/lib/adminSession";
import { adminAllowlistActive, isAllowedAdminEmail } from "@/lib/adminAllowlist";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { isGoogleAuthConfigured } from "@/lib/googleOAuth";
import { automaticallyBlockThreat, clientIpFromHeaders, isLoginLockedOut, recordSecurityEvent } from "@/lib/securityLog";
import { isVerifiedCloudflareRequest } from "@/lib/cloudflareSecurity";

async function enforceFailedLogin(requestHeaders: Headers, ip: string | null) {
  if (isVerifiedCloudflareRequest(requestHeaders)) await automaticallyBlockThreat(ip);
}

function safeRedirectPath(from: string | null, fallback = "/admin") {
  if (!from || !from.startsWith("/")) return fallback;
  if (from.startsWith("//")) return "/admin";
  return from;
}

export async function loginAction(formData: FormData) {
  const password = formData.get("password") as string;
  const wantsEditMode = formData.get("editMode") === "1";
  const from = safeRedirectPath(formData.get("from") as string | null, wantsEditMode ? "/" : "/admin");

  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);

  if (isLoginLockedOut(ip)) {
    // Still count the attempt so the lockout window keeps sliding.
    recordSecurityEvent({
      kind: "failed_login",
      path: "/admin/login",
      method: "POST",
      ip,
      userAgent: requestHeaders.get("user-agent"),
    });
    await enforceFailedLogin(requestHeaders, ip);
    const params = new URLSearchParams({ error: "locked", from });
    if (wantsEditMode) params.set("editMode", "1");
    redirect(`/admin/login?${params.toString()}`);
  }

  // When the allowlist is configured (and Google OAuth is available), the
  // browser must be signed in with an allowlisted Google account before the
  // password is even considered.
  if (adminAllowlistActive() && isGoogleAuthConfigured()) {
    const userSession = await getUserSession();
    if (!isSignedIn(userSession)) {
      const params = new URLSearchParams({ error: "signin", from });
      if (wantsEditMode) params.set("editMode", "1");
      redirect(`/admin/login?${params.toString()}`);
    }
    if (!isAllowedAdminEmail(userSession.email)) {
      recordSecurityEvent({
        kind: "failed_login",
        path: "/admin/login",
        method: "POST",
        ip,
        userAgent: `not-allowlisted:${userSession.email} ${requestHeaders.get("user-agent") ?? ""}`,
      });
      await enforceFailedLogin(requestHeaders, ip);
      const params = new URLSearchParams({ error: "forbidden", from });
      if (wantsEditMode) params.set("editMode", "1");
      redirect(`/admin/login?${params.toString()}`);
    }
  }

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    recordSecurityEvent({
      kind: "failed_login",
      path: "/admin/login",
      method: "POST",
      ip,
      userAgent: requestHeaders.get("user-agent"),
    });
    await enforceFailedLogin(requestHeaders, ip);
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
