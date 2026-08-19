import { feedbackCounts } from "@/lib/voiceFeedback";
import { getContentSyncJobStatuses } from "@/lib/contentScheduler";
import { getSecuritySummary } from "@/lib/securityLog";
import { listGuideRatingsForAdmin } from "@/lib/adventsGuide";

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

export interface AdminSnapshot {
  feedback: { new: number; reviewed: number; total: number };
  sync: { failed: string[]; total: number; running: number };
  security: {
    days: number;
    failedLogins: number;
    suspiciousRequests: number;
    adminRequests: number;
    topOffenderIp: string | null;
  };
  ratings: {
    reviews: number;
    locations: number;
    flagged: number;
    censored: number;
    latestReviewAt: string | null;
  };
}

/** Gather the admin snapshot. Each source is isolated so a missing table or a
 *  slow query can never block a voice session from starting. */
export function gatherAdminSnapshot(): AdminSnapshot {
  let feedback = { new: 0, reviewed: 0, total: 0 };
  try {
    const counts = feedbackCounts();
    feedback = { new: counts.new ?? 0, reviewed: counts.reviewed ?? 0, total: counts.total ?? 0 };
  } catch { /* leave zeroes */ }

  let sync = { failed: [] as string[], total: 0, running: 0 };
  try {
    const jobs = getContentSyncJobStatuses().filter((job) => job.enabled);
    sync = {
      failed: jobs.filter((job) => job.lastStatus === "failed").map((job) => job.label),
      total: jobs.length,
      running: jobs.filter((job) => job.lastStatus === "running").length,
    };
  } catch { /* leave empty */ }

  let security = {
    days: SECURITY_WINDOW_DAYS,
    failedLogins: 0,
    suspiciousRequests: 0,
    adminRequests: 0,
    topOffenderIp: null as string | null,
  };
  try {
    const summary = getSecuritySummary(SECURITY_WINDOW_DAYS);
    security = {
      days: summary.days,
      failedLogins: summary.failedLogins,
      suspiciousRequests: summary.suspiciousRequests,
      adminRequests: summary.adminRequests,
      topOffenderIp: summary.topOffenderIps[0]?.ip ?? null,
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

  return { feedback, sync, security, ratings };
}

/** Format the snapshot as a compact, explicitly admin-only, out-of-world block.
 *  Pure over its input so it can be unit-tested without a database. */
export function formatAdminSnapshot(snapshot: AdminSnapshot): string {
  const lines: string[] = [
    "ADMIN-ONLY website operations status. This block is present ONLY because a",
    "verified Suwanee Gamers admin is signed in and talking to you right now. It is",
    "real-world back-office information about the website, NOT the Myrdae game world,",
    "campaign lore, or Chronicles. Answer this admin's operational questions from it,",
    "keep every number exact, and never invent operational facts. If a question is",
    "not covered here, say you don't have that in the admin snapshot.",
    "",
    `- Site feedback: ${snapshot.feedback.new} new, ${snapshot.feedback.reviewed} reviewed, ${snapshot.feedback.total} total (see /admin/feedback).`,
  ];

  if (snapshot.sync.failed.length > 0) {
    lines.push(
      `- Content sync: ${snapshot.sync.failed.length} of ${snapshot.sync.total} nightly jobs FAILED on their last run: ${snapshot.sync.failed.join(", ")} (see /admin/source-managed).`,
    );
  } else {
    lines.push(
      `- Content sync: all ${snapshot.sync.total} nightly jobs green on their last run${snapshot.sync.running > 0 ? `, ${snapshot.sync.running} running now` : ""}.`,
    );
  }

  lines.push(
    `- Security (last ${snapshot.security.days} days): ${snapshot.security.failedLogins} failed admin logins, ${snapshot.security.suspiciousRequests} suspicious requests, ${snapshot.security.adminRequests} unauthorized admin hits${snapshot.security.topOffenderIp ? `, top source ${snapshot.security.topOffenderIp}` : ""} (see /admin/security).`,
  );

  const latest = snapshot.ratings.latestReviewAt
    ? `; newest ${snapshot.ratings.latestReviewAt.slice(0, 10)}`
    : "";
  lines.push(
    `- Map ratings to moderate: ${snapshot.ratings.reviews} reviews across ${snapshot.ratings.locations} locations, ${snapshot.ratings.flagged} flagged, ${snapshot.ratings.censored} hidden${latest} (see /admin/advents-guide).`,
  );

  return lines.join("\n");
}

/**
 * The admin snapshot block for dispatch metadata. Returns "" unless the caller
 * has already proven — in the token route — that a verified admin is signed in,
 * so the data is never present in metadata for anyone else.
 */
export function getAdminSnapshotForAgent(isVerifiedAdmin: boolean): string {
  if (!isVerifiedAdmin) return "";
  return formatAdminSnapshot(gatherAdminSnapshot());
}
