import Link from "next/link";
import { Lightbulb, ThumbsDown, Heart, MessageSquare } from "lucide-react";
import { requireAdmin } from "@/lib/adminAuth";
import {
  listVoiceFeedback,
  feedbackCounts,
  type FeedbackEntry,
  type FeedbackKind,
} from "@/lib/voiceFeedback";
import { setFeedbackStatusAction } from "./actions";

export const dynamic = "force-dynamic";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const KIND_META: Record<
  FeedbackKind,
  { label: string; className: string; Icon: typeof Lightbulb }
> = {
  wish: {
    label: "Wish",
    className: "border-violet-800 bg-violet-950/40 text-violet-300",
    Icon: Lightbulb,
  },
  complaint: {
    label: "Complaint",
    className: "border-amber-800 bg-amber-950/40 text-amber-300",
    Icon: ThumbsDown,
  },
  praise: {
    label: "Praise",
    className: "border-emerald-900 bg-emerald-950/40 text-emerald-300",
    Icon: Heart,
  },
};

function KindBadge({ kind }: { kind: FeedbackKind }) {
  const meta = KIND_META[kind] ?? KIND_META.wish;
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${meta.className}`}
    >
      <Icon size={11} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function StatusButton({
  id,
  status,
  label,
  current,
}: {
  id: number;
  status: string;
  label: string;
  current: string;
}) {
  const active = current === status;
  return (
    <form action={setFeedbackStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        disabled={active}
        className={`rounded border px-2.5 py-1 text-xs transition-colors ${
          active
            ? "cursor-default border-[#8b5cf6] bg-[#16161e] text-[#e8dfc8]"
            : "border-[#2a2a35] text-[#a89880] hover:border-[#8b5cf6] hover:text-[#f59e0b]"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function FeedbackCard({ entry }: { entry: FeedbackEntry }) {
  return (
    <li className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5a5060]">
        <KindBadge kind={entry.kind} />
        {entry.status !== "new" && (
          <span className="rounded-full border border-[#2a2a35] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#9080a0]">
            {entry.status}
          </span>
        )}
        <span className="ml-auto">{dateTime(entry.createdAt)}</span>
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-[#e8dfc8]">
        &ldquo;{entry.message}&rdquo;
      </p>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#7a6f85]">
        <span>{entry.memberName ? entry.memberName : "Anonymous member"}</span>
        {entry.pagePath && (
          <span>
            on <code className="text-[#a89880]">{entry.pagePath}</code>
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-[#21182e] pt-3">
        <StatusButton id={entry.id} status="reviewed" label="Reviewed" current={entry.status} />
        <StatusButton id={entry.id} status="done" label="Done" current={entry.status} />
        <StatusButton id={entry.id} status="dismissed" label="Dismiss" current={entry.status} />
        {entry.status !== "new" && (
          <StatusButton id={entry.id} status="new" label="Reopen" current={entry.status} />
        )}
      </div>
    </li>
  );
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const includeResolved = params.all === "1";
  const entries = listVoiceFeedback({ includeResolved });
  const counts = feedbackCounts();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="font-cinzel text-2xl text-[#e8dfc8]">User Feedback</h1>
        <p className="mt-1 text-sm text-[#7a6f85]">
          Wishes, complaints, and praise visitors voiced to Myra — what the group
          might improve on the site.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#9080a0]">
          <span>
            <strong className="text-[#e8dfc8]">{counts.new}</strong> new
          </span>
          <span>
            <strong className="text-[#e8dfc8]">{counts.reviewed}</strong> reviewed
          </span>
          <span>
            <strong className="text-[#e8dfc8]">{counts.done}</strong> done
          </span>
          <span>
            <strong className="text-[#e8dfc8]">{counts.total}</strong> total
          </span>
        </div>
        <div className="mt-3 flex gap-3 text-xs">
          <Link
            href="/admin/feedback"
            className={`transition-colors hover:text-[#f59e0b] ${
              includeResolved ? "text-[#a89880]" : "text-[#f59e0b]"
            }`}
          >
            Open items
          </Link>
          <Link
            href="/admin/feedback?all=1"
            className={`transition-colors hover:text-[#f59e0b] ${
              includeResolved ? "text-[#f59e0b]" : "text-[#a89880]"
            }`}
          >
            All (incl. resolved)
          </Link>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#2a2a35] py-16 text-center text-[#5a5060]">
          <MessageSquare size={28} aria-hidden="true" />
          <p className="text-sm">
            {includeResolved
              ? "No feedback has been captured yet."
              : "No open feedback. Nice and tidy."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <FeedbackCard key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}
