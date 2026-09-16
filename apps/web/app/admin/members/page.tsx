import Link from "next/link";
import { ArrowLeft, ShieldCheck, UserPlus, Ban } from "lucide-react";
import { listSiteMembers, NEW_MEMBER_DAYS } from "@/lib/userProfiles";
import { listMemberBlocks } from "@/lib/memberBlocks";
import { blockMemberAction, unblockMemberAction } from "./actions";

export const dynamic = "force-dynamic";

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function relativeDays(value: string) {
  const days = Math.floor((Date.now() - Date.parse(value)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function NewBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700 bg-emerald-950/40 px-2 py-0.5 font-sans text-[9px] uppercase tracking-wider text-emerald-300">
      <UserPlus className="h-2.5 w-2.5" /> New
    </span>
  );
}

function RosterBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-violet-800 bg-violet-950/40 px-2 py-0.5 font-sans text-[9px] uppercase tracking-wider text-violet-300">
      <ShieldCheck className="h-2.5 w-2.5" /> Roster
    </span>
  );
}

export default function AdminMembersPage() {
  const members = listSiteMembers();
  const blocks = listMemberBlocks();
  const blockedEmails = new Set(blocks.map((block) => block.email));
  const newCount = members.filter((member) => member.isNew).length;
  const offRoster = members.filter((member) => !member.onRoster).length;

  return (
    <div>
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#a89880] hover:text-[#f59e0b]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>

      <h1 className="font-cinzel text-3xl tracking-widest uppercase mb-2">Members</h1>
      <p className="text-sm text-[#a89880] mb-8 max-w-2xl">
        Everyone who has signed in with Google, newest first. A member is recorded the first time
        they load a page while signed in. The <span className="text-emerald-300">New</span> badge
        marks anyone who first signed in within the last {NEW_MEMBER_DAYS} days — it is anchored to
        the join date, so it stays until the person is no longer new.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-5">
          <div className="text-3xl font-cinzel text-[#f59e0b]">{members.length}</div>
          <div className="mt-1 text-xs uppercase tracking-widest text-[#a89880]">Total members</div>
        </div>
        <div className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-5">
          <div className="text-3xl font-cinzel text-emerald-300">{newCount}</div>
          <div className="mt-1 text-xs uppercase tracking-widest text-[#a89880]">
            New (last {NEW_MEMBER_DAYS}d)
          </div>
        </div>
        <div className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-5">
          <div className="text-3xl font-cinzel text-[#c9b8a8]">{offRoster}</div>
          <div className="mt-1 text-xs uppercase tracking-widest text-[#a89880]">Not on roster</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#2a2a35]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#2a2a35] text-[10px] uppercase tracking-widest text-[#6a5a78]">
              <th className="px-4 py-3 font-sans font-normal">Member</th>
              <th className="px-4 py-3 font-sans font-normal">Joined</th>
              <th className="px-4 py-3 font-sans font-normal">Last seen</th>
              <th className="px-4 py-3 font-sans font-normal">Access</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isBlocked = blockedEmails.has(member.email.toLowerCase());
              return (
                <tr
                  key={member.id}
                  className={`border-b border-[#1c1826] last:border-0 ${member.isNew ? "bg-emerald-950/10" : ""} ${isBlocked ? "bg-red-950/10" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[#e8dcc8]">{member.name}</span>
                      {member.isNew && <NewBadge />}
                      {member.onRoster && <RosterBadge />}
                    </div>
                    <div className="mt-0.5 text-xs text-[#6a5a78]">{member.email}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-[#c9b8a8]">{dateTime(member.joinedAt)}</div>
                    <div className="text-xs text-[#6a5a78]">{relativeDays(member.joinedAt)}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-[#c9b8a8]">{dateTime(member.lastSeenAt)}</td>
                  <td className="px-4 py-3 align-top">
                    {isBlocked ? (
                      <form action={unblockMemberAction}>
                        <input type="hidden" name="email" value={member.email} />
                        <button
                          type="submit"
                          className="rounded border border-red-800 bg-red-950/40 px-2 py-1 font-sans text-[10px] uppercase tracking-wider text-red-300 hover:bg-red-950/70"
                        >
                          Unblock
                        </button>
                      </form>
                    ) : (
                      <form action={blockMemberAction}>
                        <input type="hidden" name="email" value={member.email} />
                        <input type="hidden" name="displayName" value={member.name} />
                        <input type="hidden" name="reason" value="Blocked from the Members admin page" />
                        <button
                          type="submit"
                          className="rounded border border-[#2a2a35] px-2 py-1 font-sans text-[10px] uppercase tracking-wider text-[#a89880] hover:border-red-800 hover:text-red-300"
                        >
                          Block
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {members.length === 0 && (
          <p className="p-8 text-center text-xs text-[#6a5a78]">No members have signed in yet.</p>
        )}
      </div>

      <h2 className="font-cinzel text-xl tracking-widest uppercase mt-10 mb-2 flex items-center gap-2">
        <Ban className="h-4 w-4 text-red-400" /> Blocked
      </h2>
      <p className="text-sm text-[#a89880] mb-4 max-w-2xl">
        Blocking a member ends their access immediately, on any provider (Google or Discord), even
        mid-session. You can also block an email that has never signed in, to keep it out ahead of
        time.
      </p>

      <form
        action={blockMemberAction}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-4"
      >
        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-[#6a5a78]">
          Email
          <input
            type="email"
            name="email"
            required
            placeholder="name@example.com"
            className="rounded border border-[#2a2a35] bg-[#151020] px-2 py-1.5 text-sm text-[#e8dcc8] normal-case tracking-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-[#6a5a78]">
          Reason (optional)
          <input
            type="text"
            name="reason"
            placeholder="Why is this account blocked?"
            className="w-64 rounded border border-[#2a2a35] bg-[#151020] px-2 py-1.5 text-sm text-[#e8dcc8] normal-case tracking-normal"
          />
        </label>
        <button
          type="submit"
          className="rounded border border-red-800 bg-red-950/40 px-3 py-1.5 font-sans text-xs uppercase tracking-wider text-red-300 hover:bg-red-950/70"
        >
          Block email
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-[#2a2a35]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#2a2a35] text-[10px] uppercase tracking-widest text-[#6a5a78]">
              <th className="px-4 py-3 font-sans font-normal">Email</th>
              <th className="px-4 py-3 font-sans font-normal">Reason</th>
              <th className="px-4 py-3 font-sans font-normal">Blocked</th>
              <th className="px-4 py-3 font-sans font-normal" />
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => (
              <tr key={block.email} className="border-b border-[#1c1826] last:border-0">
                <td className="px-4 py-3">
                  <div className="text-[#e8dcc8]">{block.displayName ?? block.email}</div>
                  {block.displayName && (
                    <div className="mt-0.5 text-xs text-[#6a5a78]">{block.email}</div>
                  )}
                </td>
                <td className="px-4 py-3 align-top text-[#c9b8a8]">{block.reason ?? "—"}</td>
                <td className="px-4 py-3 align-top text-[#c9b8a8]">{dateTime(block.createdAt)}</td>
                <td className="px-4 py-3 align-top">
                  <form action={unblockMemberAction}>
                    <input type="hidden" name="email" value={block.email} />
                    <button
                      type="submit"
                      className="rounded border border-[#2a2a35] px-2 py-1 font-sans text-[10px] uppercase tracking-wider text-[#a89880] hover:border-emerald-700 hover:text-emerald-300"
                    >
                      Unblock
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {blocks.length === 0 && (
          <p className="p-8 text-center text-xs text-[#6a5a78]">No one is currently blocked.</p>
        )}
      </div>
    </div>
  );
}
