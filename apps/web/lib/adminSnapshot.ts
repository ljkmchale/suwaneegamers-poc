import { feedbackCounts } from "@/lib/voiceFeedback";
import { getContentSyncJobStatuses } from "@/lib/contentScheduler";
import { getSecuritySummary } from "@/lib/securityLog";
import { listGuideRatingsForAdmin } from "@/lib/adventsGuide";
import { getSignedInMemberActivity, type SignedInMemberActivity } from "@/lib/analytics";
import { listSiteMembers, NEW_MEMBER_DAYS } from "@/lib/userProfiles";
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
const MEMBER_WINDOW_DAYS = 7;
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
  /** Who has been USING the site (signed-in members) and what pages they viewed,
   *  over the last MEMBER_WINDOW_DAYS. Sign-in / usage view, NOT the security log. */
  members: {
    days: number;
    memberCount: number;
    activeNow: number;
    list: SignedInMemberActivity[];
    /** Total members ever recorded (join-based, from user_profiles). */
    totalMembers: number;
    /** Members who first signed in within the last newMemberDays. */
    newMemberDays: number;
    newMembers: Array<{ name: string; joinedAt: string; onRoster: boolean }>;
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

  let members = {
    days: MEMBER_WINDOW_DAYS,
    memberCount: 0,
    activeNow: 0,
    list: [] as SignedInMemberActivity[],
    totalMembers: 0,
    newMemberDays: NEW_MEMBER_DAYS,
    newMembers: [] as Array<{ name: string; joinedAt: string; onRoster: boolean }>,
  };
  try {
    const usage = getSignedInMemberActivity(MEMBER_WINDOW_DAYS);
    const roster = listSiteMembers();
    members = {
      days: usage.days,
      memberCount: usage.memberCount,
      activeNow: usage.activeNow,
      list: usage.members,
      totalMembers: roster.length,
      newMemberDays: NEW_MEMBER_DAYS,
      newMembers: roster
        .filter((member) => member.isNew)
        .map((member) => ({ name: member.name, joinedAt: member.joinedAt, onRoster: member.onRoster })),
    };
  } catch { /* leave empty */ }

  return {
    capturedAt: new Date().toISOString(),
    feedback,
    sync,
    security,
    ratings,
    latestContentChange,
    members,
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
    "",
    `Who's using the site (signed-in members, last ${snapshot.members.days} days — this is the`,
    `sign-in / usage view, NOT the security log). Use it to answer "who has been using`,
    `the site", "who's been on lately", "who's on right now", and "what has <member>`,
    `been doing / looking at". ${snapshot.members.memberCount} member(s) active${
      snapshot.members.activeNow > 0 ? `, ${snapshot.members.activeNow} on right now` : ""
    }; ${snapshot.members.totalMembers} members total. ${
      snapshot.members.newMembers.length > 0
        ? `New sign-ups in the last ${snapshot.members.newMemberDays} days (answer "who's new / any new members / who just joined" from these): ${snapshot.members.newMembers
            .map((member) => `${member.name} (joined ${localMoment(member.joinedAt, timezone)}${member.onRoster ? "" : ", not on the roster"})`)
            .join("; ")}.`
        : `No new members have joined in the last ${snapshot.members.newMemberDays} days.`
    } Full member list at /admin/members; usage detail at /admin/analytics:`,
    ...(snapshot.members.list.length > 0
      ? snapshot.members.list.map((member) => {
          const pages = member.topPages.length > 0 ? member.topPages.join(", ") : "no pages recorded";
          return `- ${member.name}${member.activeNow ? " (on now)" : ""}: last seen ${localMoment(
            member.lastSeenAt,
            timezone,
          )}, ${member.sessions} visit(s), ${member.pageViews} page views, ~${member.engagedMinutes} min engaged; most-viewed pages: ${pages}.`;
        })
      : ["- No signed-in members have been active in this window."]),
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
