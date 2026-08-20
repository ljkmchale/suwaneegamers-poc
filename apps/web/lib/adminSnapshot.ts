import { feedbackCounts } from "@/lib/voiceFeedback";
import { getContentSyncJobStatuses } from "@/lib/contentScheduler";
import { getSecuritySummary } from "@/lib/securityLog";
import { listGuideRatingsForAdmin } from "@/lib/adventsGuide";
import { getDb } from "@/lib/db";

// Myra's ADMIN compartment — a read-only operational snapshot of the site's
// back office, surfaced ONLY when a verified, signed-in admin is the one talking
// to her. It is deliberately a separate channel from every other block she
// carries: not in-world lore, not the public roadmap/updates, not the public
// health summary.
//
// SECURITY: this block must never reach a non-admin. The gate lives in the
// LiveKit token route (which checks the sg-admin session AND the ADMIN_EMAILS
// allowlist); getAdminSnapshotForAgent() returns "" unless that gate passes, so
// for everyone else the admin data is simply absent from dispatch metadata. This
// module never reads cookies or decides authorization itself — it only formats.

const SECURITY_WINDOW_DAYS = 7;
const DEFAULT_TIMEZONE = "America/New_York";

export interface AdminSnapshot {
  /** ISO timestamp the snapshot was taken, so "last night / recently" has an anchor. */
  capturedAt: string;
  feedback: { new: number; reviewed: number; total: number };
  sync: { failed: string[]; total: number; running: number; lastFinishedAt: string | null };
  security: {
    days: number;
    failedLogins: number;
    suspiciousRequests: number;
    adminRequests: number;
    topOffenderIp: string | null;
    /** Events in just the last 24h, for "did anything happen last night". */
    last24h: number;
  };
  ratings: {
    reviews: number;
    locations: number;
    flagged: number;
    censored: number;
    latestReviewAt: string | null;
  };
  /** Most recently changed content document, for "what changed overnight". */
  latestContentChange: { name: string; at: string } | null;
}

/** Gather the admin snapshot. Each source is isolated so a missing table or a
 *  slow query can never block a voice session from starting. */
export function gatherAdminSnapshot(): AdminSnapshot {
  let feedback = { new: 0, reviewed: 0, total: 0 };
  try {
    const counts = feedbackCounts();
    feedback = { new: counts.new ?? 0, reviewed: counts.reviewed ?? 0, total: counts.total ?? 0 };
  } catch { /* leave zeroes */ }

  let sync = { failed: [] as string[], total: 0, running: 0, lastFinishedAt: null as string | null };
  try {
    const jobs = getContentSyncJobStatuses().filter((job) => job.enabled);
    const lastFinishedAt = jobs
      .map((job) => job.lastFinishedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    sync = {
      failed: jobs.filter((job) => job.lastStatus === "failed").map((job) => job.label),
      total: jobs.length,
      running: jobs.filter((job) => job.lastStatus === "running").length,
      lastFinishedAt,
    };
  } catch { /* leave empty */ }

  let security = {
    days: SECURITY_WINDOW_DAYS,
    failedLogins: 0,
    suspiciousRequests: 0,
    adminRequests: 0,
    topOffenderIp: null as string | null,
    last24h: 0,
  };
  try {
    const summary = getSecuritySummary(SECURITY_WINDOW_DAYS);
    const day = getSecuritySummary(1);
    security = {
      days: summary.days,
      failedLogins: summary.failedLogins,
      suspiciousRequests: summary.suspiciousRequests,
      adminRequests: summary.adminRequests,
      topOffenderIp: summary.topOffenderIps[0]?.ip ?? null,
      last24h: day.failedLogins + day.suspiciousRequests + day.adminRequests,
    };
  } catch { /* leave zeroes */ }

  let ratings = { reviews: 0, locations: 0, flagged: 0, censored: 0, latestReviewAt: null as string | null };
  try {
    const locations = listGuideRatingsForAdmin("recent");
    const latest = locations
      .map((location) => location.latestReviewAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
    ratings = {
      reviews: locations.reduce((sum, location) => sum + location.reviewCount, 0),
      locations: locations.length,
      flagged: locations.reduce((sum, location) => sum + location.flaggedCount, 0),
      censored: locations.reduce((sum, location) => sum + location.censoredCount, 0),
      latestReviewAt: latest,
    };
  } catch { /* leave zeroes */ }

  let latestContentChange: { name: string; at: string } | null = null;
  try {
    const row = getDb()
      .prepare("SELECT path, updated_at FROM content_documents ORDER BY updated_at DESC LIMIT 1")
      .get() as { path: string; updated_at: string } | undefined;
    if (row) latestContentChange = { name: row.path, at: row.updated_at };
  } catch { /* leave null */ }

  return {
    capturedAt: new Date().toISOString(),
    feedback,
    sync,
    security,
    ratings,
    latestContentChange,
  };
}

/** Render an ISO timestamp as a local day-and-time so "last night" resolves. */
function localMoment(iso: string | null, timezone: string): string {
  if (!iso) return "unknown";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "unknown";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}

/** Format the snapshot as a compact, explicitly admin-only, out-of-world block.
 *  Pure over its input so it can be unit-tested without a database. */
export function formatAdminSnapshot(snapshot: AdminSnapshot, timezone = DEFAULT_TIMEZONE): string {
  const now = localMoment(snapshot.capturedAt, timezone);
  const lines: string[] = [
    "ADMIN-ONLY website operations status. This block is present ONLY because a",
    "verified Suwanee Gamers admin is signed in and talking to you right now. It is",
    "real-world back-office information about the website, NOT the Myrdae game world,",
    "campaign lore, or Chronicles. Answer this admin's operational questions from it,",
    "keep every number exact, and never invent operational facts. If a question is",
    "not covered here, say you don't have that in the admin snapshot.",
    "",
    `Snapshot taken ${now} (${timezone}). Timestamps below are local; use them to answer`,
    `"did anything happen last night / overnight / recently".`,
    "",
    "Overnight & recent activity:",
    `- Last content sync finished ${localMoment(snapshot.sync.lastFinishedAt, timezone)}${
      snapshot.sync.failed.length > 0
        ? ` with ${snapshot.sync.failed.length} FAILED job(s): ${snapshot.sync.failed.join(", ")}`
        : " — all jobs green"
    }${snapshot.sync.running > 0 ? `; ${snapshot.sync.running} running now` : ""}.`,
    `- Security events in the last 24 hours: ${snapshot.security.last24h}.`,
    snapshot.latestContentChange
      ? `- Most recent content change: ${snapshot.latestContentChange.name} at ${localMoment(snapshot.latestContentChange.at, timezone)}.`
      : "- Most recent content change: none recorded.",
    "",
    "Standing totals:",
    `- Site feedback: ${snapshot.feedback.new} new, ${snapshot.feedback.reviewed} reviewed, ${snapshot.feedback.total} total (see /admin/feedback).`,
    `- Content sync jobs: ${snapshot.sync.total} enabled${snapshot.sync.failed.length > 0 ? `, ${snapshot.sync.failed.length} currently failing` : ", all green"} (see /admin/source-managed).`,
    `- Security (last ${snapshot.security.days} days): ${snapshot.security.failedLogins} failed admin logins, ${snapshot.security.suspiciousRequests} suspicious requests, ${snapshot.security.adminRequests} unauthorized admin hits${snapshot.security.topOffenderIp ? `, top source ${snapshot.security.topOffenderIp}` : ""} (see /admin/security).`,
    `- Map ratings to moderate: ${snapshot.ratings.reviews} reviews across ${snapshot.ratings.locations} locations, ${snapshot.ratings.flagged} flagged, ${snapshot.ratings.censored} hidden${snapshot.ratings.latestReviewAt ? `; newest ${localMoment(snapshot.ratings.latestReviewAt, timezone)}` : ""} (see /admin/advents-guide).`,
  ];

  return lines.join("\n");
}

/**
 * The admin snapshot block for dispatch metadata. Returns "" unless the caller
 * has already proven — in the token route — that a verified admin is signed in,
 * so the data is never present in metadata for anyone else.
 */
export function getAdminSnapshotForAgent(isVerifiedAdmin: boolean, timezone = DEFAULT_TIMEZONE): string {
  if (!isVerifiedAdmin) return "";
  return formatAdminSnapshot(gatherAdminSnapshot(), timezone);
}
