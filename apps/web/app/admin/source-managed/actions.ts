"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  lockPage,
  unlockPage,
  setPageSourceUrl,
  setManagedSourceUrl,
  addManagedSource,
  removeManagedSource,
} from "@/lib/autoManagedPagesData";
import { refreshManagedPage, refreshJobById } from "@/lib/managedPageRefresh";
import { getDb } from "@/lib/db";
import { type ScheduleSpec, computeNextRun, formatScheduleSpec } from "@/lib/scheduleSpec";

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
  const section = (formData.get("section") as string | null)?.trim() || undefined;
  setManagedSourceUrl(path, sourceKey, url, section);
  revalidatePath(path);
  revalidatePath("/admin/source-managed");
}

function parseScheduleSpec(formData: FormData): ScheduleSpec {
  const kind = formData.get("kind") as string;
  if (kind === "interval") {
    const hours = parseInt(formData.get("hours") as string, 10);
    if (!hours || hours < 1 || hours > 168) throw new Error("Hours must be between 1 and 168.");
    return { kind: "interval", hours };
  }
  if (kind === "times") {
    const raw = (formData.get("times") as string ?? "").trim();
    const times = raw.split(",").map((t) => t.trim()).filter(Boolean);
    if (times.length === 0) throw new Error("At least one time is required.");
    for (const t of times) {
      if (!/^\d{1,2}:\d{2}$/.test(t)) throw new Error(`Invalid time format: ${t}`);
    }
    return { kind: "times", times };
  }
  const time = (formData.get("time") as string ?? "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(time)) throw new Error("Invalid time format.");
  return { kind: "daily", time };
}

export async function updateJobScheduleAction(formData: FormData) {
  const jobId = formData.get("jobId") as string;
  const spec = parseScheduleSpec(formData);
  const nextRunAt = computeNextRun(spec, new Date()).toISOString();
  getDb()
    .prepare(`UPDATE content_sync_jobs SET schedule_json = ?, next_run_at = ? WHERE id = ?`)
    .run(JSON.stringify(spec), nextRunAt, jobId);
  revalidatePath("/admin/source-managed");
}

export async function addManagedSourceAction(formData: FormData) {
  const path = formData.get("path") as string;
  const label = (formData.get("label") as string).trim();
  const url = (formData.get("url") as string).trim();
  const section = (formData.get("section") as string | null)?.trim() || undefined;
  if (!label || !url) return;
  addManagedSource(path, { label, url, section });
  revalidatePath(path);
  revalidatePath("/admin/source-managed");
}

export async function removeManagedSourceAction(formData: FormData) {
  const path = formData.get("path") as string;
  const sourceKey = formData.get("sourceKey") as string;
  const match = /^managedSources\.(\d+)$/.exec(sourceKey);
  if (!match) return;
  removeManagedSource(path, Number(match[1]));
  revalidatePath(path);
  revalidatePath("/admin/source-managed");
}

export async function addPageScheduleAction(formData: FormData) {
  const pagePath = formData.get("pagePath") as string;
  const pageLabel = formData.get("pageLabel") as string;
  const customLabel = (formData.get("label") as string | null)?.trim();
  const spec = parseScheduleSpec(formData);
  const label = customLabel || `${pageLabel} — Revalidate`;
  const jobId = `revalidate::${pagePath.replace(/^\//, "").replace(/\//g, "::") || "home"}::${Date.now()}`;
  const nextRunAt = computeNextRun(spec, new Date()).toISOString();

  // Resolve which hardcoded job to mirror — prefer explicit sourceJobId, fall back to label match
  const sourceJobId = (formData.get("sourceJobId") as string | null)?.trim() || null;
  const matchingJob = sourceJobId
    ? (getDb()
        .prepare(`SELECT id FROM content_sync_jobs WHERE id = ? AND revalidate_paths_json IS NULL`)
        .get(sourceJobId) as { id: string } | undefined)
    : customLabel
      ? (getDb()
          .prepare(`SELECT id FROM content_sync_jobs WHERE label = ? AND revalidate_paths_json IS NULL LIMIT 1`)
          .get(customLabel) as { id: string } | undefined)
      : undefined;

  getDb()
    .prepare(
      `INSERT INTO content_sync_jobs (id, label, schedule, command, enabled, next_run_at, schedule_json, revalidate_paths_json, source_job_id)
       VALUES (?, ?, ?, '__revalidate__', 1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         label = excluded.label,
         schedule = excluded.schedule,
         schedule_json = excluded.schedule_json,
         next_run_at = excluded.next_run_at,
         source_job_id = excluded.source_job_id`,
    )
    .run(
      jobId,
      label,
      formatScheduleSpec(spec, ""),
      nextRunAt,
      JSON.stringify(spec),
      JSON.stringify([pagePath]),
      matchingJob?.id ?? null,
    );
  revalidatePath("/admin/source-managed");
}

export async function removePageScheduleAction(jobId: string) {
  getDb()
    .prepare(`DELETE FROM content_sync_jobs WHERE id = ? AND revalidate_paths_json IS NOT NULL`)
    .run(jobId);
  revalidatePath("/admin/source-managed");
}

export async function refreshJobAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const jobId = formData.get("jobId") as string;
  try {
    const result = await refreshJobById(jobId);
    revalidatePath("/admin/source-managed");
    return { ok: true, message: result.message };
  } catch (error) {
    revalidatePath("/admin/source-managed");
    return { ok: false, message: refreshMessageFromError(error) };
  }
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

  revalidatePath(path, "layout");
  revalidatePath("/admin/source-managed");
  redirect(
    `/admin/source-managed?status=${status}&path=${encodeURIComponent(path)}&message=${encodeURIComponent(message)}`,
  );
}
