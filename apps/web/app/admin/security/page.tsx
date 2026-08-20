import {
  Activity,
  Bot,
  KeyRound,
  Radar,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Ban,
  CircleOff,
} from "lucide-react";
import {
  getRecentSecurityEvents,
  getSecuritySituation,
  getSecuritySummary,
} from "@/lib/securityLog";
import type { ThreatLevel } from "@/lib/securityClassifier";
import { cloudflareSecurityConfigured, getSecurityBlocks } from "@/lib/cloudflareSecurity";
import { blockIpAction, unblockIpAction } from "./actions";
import { ConfirmSecurityAction } from "./ConfirmSecurityAction";

export const dynamic = "force-dynamic";

const DAYS = 7;

const KIND_LABELS: Record<string, string> = {
  failed_login: "Failed login",
  admin_request: "Admin probe",
  suspicious_request: "Scanner probe",
};

function kindClass(kind: string) {
  if (kind === "failed_login") return "border-red-900 text-red-300 bg-red-950/30";
  if (kind === "suspicious_request") return "border-amber-800 text-amber-300 bg-amber-950/30";
  return "border-[#2a2a35] text-[#9080a0]";
}

const THREAT_DISPLAY: Record<
  ThreatLevel,
  { title: string; detail: string; className: string; icon: typeof ShieldCheck }
> = {
  normal: {
    title: "No active attack detected",
    detail: "Current activity looks normal. No security pattern crossed an alert threshold in the last hour.",
    className: "border-emerald-800/70 bg-emerald-950/20 text-emerald-300",
    icon: ShieldCheck,
  },
  system: {
    title: "Local checks only",
    detail: "Recent security-sensitive requests came from this server or the private network.",
    className: "border-sky-800/70 bg-sky-950/20 text-sky-300",
    icon: ShieldCheck,
  },
  scanner: {
    title: "Background internet scanning",
    detail: "Automated scanners are knocking on common vulnerability paths. That is hostile noise, not evidence they got in.",
    className: "border-amber-800/70 bg-amber-950/20 text-amber-300",
    icon: Bot,
  },
  suspicious: {
    title: "Suspicious activity needs review",
    detail: "Repeated security-sensitive requests were detected, but the evidence does not yet prove an active attack.",
    className: "border-orange-700/70 bg-orange-950/20 text-orange-300",
    icon: TriangleAlert,
  },
  attack: {
    title: "Likely active attack",
    detail: "A source crossed the burst, repeated-target, or failed-login threshold in the last hour.",
    className: "border-red-700 bg-red-950/30 text-red-300",
    icon: ShieldAlert,
  },
};

function threatClass(level: ThreatLevel) {
  if (level === "attack") return "border-red-800 bg-red-950/30 text-red-300";
  if (level === "suspicious") return "border-orange-800 bg-orange-950/30 text-orange-300";
  if (level === "scanner") return "border-amber-800 bg-amber-950/30 text-amber-300";
  if (level === "system") return "border-sky-800 bg-sky-950/30 text-sky-300";
  return "border-emerald-800 bg-emerald-950/20 text-emerald-300";
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function SecurityPage() {
  const summary = getSecuritySummary(DAYS);
  const situation = getSecuritySituation();
  const events = getRecentSecurityEvents({ days: DAYS, limit: 200 });
  const blocks = getSecurityBlocks();
  const activeBlocks = blocks.filter((block) => block.status === "active");
  const inactiveBlockHistory = blocks.filter((block) => block.status !== "active");
  const blocksByIp = new Map(blocks.map((block) => [block.ip, block]));
  const cloudflareConfigured = cloudflareSecurityConfigured();
  const threat = THREAT_DISPLAY[situation.level];
  const ThreatIcon = threat.icon;

  const stats = [
    {
      label: "Failed logins",
      value: summary.failedLogins,
      icon: KeyRound,
      alert: summary.failedLogins > 0,
    },
    {
      label: "Scanner probes",
      value: summary.suspiciousRequests,
      icon: Radar,
      alert: false,
    },
    {
      label: "Admin probes",
      value: summary.adminRequests,
      icon: ShieldAlert,
      alert: false,
    },
  ];

  return (
    <div className="max-w-7xl">
      <h1 className="font-cinzel text-2xl text-[#e8dfc8]">Security</h1>
      <p className="mt-1 text-sm text-[#9080a0]">
        See whether activity looks like a real person, a local health check, ordinary scanner
        noise, or a likely active attack—and the evidence behind that decision.
      </p>

      <section className={`mt-6 rounded-xl border p-6 ${threat.className}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <ThreatIcon className="mt-0.5 shrink-0" size={30} aria-hidden="true" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] opacity-70">Right now · last 60 minutes</p>
              <h2 className="mt-2 font-cinzel text-2xl">{threat.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed opacity-80">{threat.detail}</p>
            </div>
          </div>
          <div className="rounded-lg border border-current/20 bg-black/15 px-4 py-3 text-right">
            <p className="text-2xl font-semibold">{situation.securityEvents60m}</p>
            <p className="text-[10px] uppercase tracking-wider opacity-70">security events</p>
          </div>
        </div>
      </section>

      <section className={`mt-4 rounded-lg border px-5 py-4 ${cloudflareConfigured ? "border-emerald-800/60 bg-emerald-950/15" : "border-amber-800/60 bg-amber-950/20"}`}>
        <div className="flex items-start gap-3">
          {cloudflareConfigured ? <Ban className="mt-0.5 text-emerald-300" size={20} /> : <CircleOff className="mt-0.5 text-amber-300" size={20} />}
          <div>
            <h2 className="text-sm font-semibold text-[#e8dfc8]">
              Automatic Cloudflare blocking {cloudflareConfigured ? "is active" : "needs configuration"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#9080a0]">
              Public sources are blocked at the Cloudflare edge after 5 failed admin logins in 15 minutes,
              30 scanner probes in 15 minutes, or 15 distinct vulnerability paths in one hour.
              Credential-file, installer, web-shell, and suspicious write attempts are blocked immediately.
              {!cloudflareConfigured && " Add the dedicated security API token and zone ID to enable enforcement."}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-5 py-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#9080a0]">
            <UserRound size={14} aria-hidden="true" />
            Active visitors
          </div>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{situation.activeVisitors}</p>
          <p className="mt-2 text-xs text-[#6a5a78]">
            {situation.signedInVisitors} identified · {situation.anonymousVisitors} at sign-in
          </p>
        </div>
        <div className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-5 py-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#9080a0]">
            <Activity size={14} aria-hidden="true" />
            Normal page views
          </div>
          <p className="mt-2 text-3xl font-semibold text-[#e8dfc8]">{situation.pageViews24h}</p>
          <p className="mt-2 text-xs text-[#6a5a78]">Recorded during the last 24 hours</p>
        </div>
        <div className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-5 py-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#9080a0]">
            <Bot size={14} aria-hidden="true" />
            Scanner probes
          </div>
          <p className="mt-2 text-3xl font-semibold text-amber-300">{situation.scannerEvents60m}</p>
          <p className="mt-2 text-xs text-[#6a5a78]">Automated vulnerability paths · last hour</p>
        </div>
        <div className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-5 py-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#9080a0]">
            <KeyRound size={14} aria-hidden="true" />
            Failed logins
          </div>
          <p className={`mt-2 text-3xl font-semibold ${situation.failedLogins60m ? "text-red-300" : "text-[#e8dfc8]"}`}>
            {situation.failedLogins60m}
          </p>
          <p className="mt-2 text-xs text-[#6a5a78]">Last hour · 5 in 15 minutes triggers attack</p>
        </div>
        <div className="rounded-lg border border-red-900/70 bg-red-950/20 px-5 py-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-red-300">
            <Ban size={14} aria-hidden="true" />
            Blocked at Cloudflare
          </div>
          <p className="mt-2 text-3xl font-semibold text-red-300">{activeBlocks.length}</p>
          <p className="mt-2 text-xs text-red-300/60">Cannot reach the site through this zone</p>
        </div>
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm uppercase tracking-wider text-red-300">Currently blocked at Cloudflare</h2>
            <p className="mt-2 text-xs text-[#6a5a78]">
              These sources are stopped at the Cloudflare edge before their requests reach Suwanee Gamers.
            </p>
          </div>
          <p className="text-xs text-[#9080a0]">{activeBlocks.length} active block{activeBlocks.length === 1 ? "" : "s"}</p>
        </div>
        {activeBlocks.length === 0 ? (
          <p className="mt-3 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-5 py-6 text-sm text-[#9080a0]">
            No IP addresses are currently blocked by Suwanee Gamers.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-red-900/50 bg-[#0f0a1a]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a2a35] text-xs uppercase tracking-wider text-[#9080a0]">
                  <th className="px-4 py-3">IP address</th>
                  <th className="px-4 py-3">Why it was blocked</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Blocked</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a35]">
                {activeBlocks.map((block) => (
                  <tr key={block.ip}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded border border-red-800 bg-red-950/30 px-2 py-1 font-mono text-xs text-red-300">
                        {block.ip}
                      </span>
                    </td>
                    <td className="max-w-xl px-4 py-3 text-xs text-[#c8bda8]">{block.reason}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs capitalize text-[#9080a0]">{block.source}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#9080a0]">{dateTime(block.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <form action={unblockIpAction}>
                        <input type="hidden" name="ip" value={block.ip} />
                        <ConfirmSecurityAction action="unblock" ip={block.ip} />
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm uppercase tracking-wider text-[#9080a0]">Who or what is making the requests?</h2>
            <p className="mt-2 text-xs text-[#6a5a78]">
              Sources seen during the last {DAYS} days, ranked by risk. Classification is based on behavior, not location.
            </p>
          </div>
          <p className="text-[10px] text-[#5a5060]">No alert means no detected pattern—not a guarantee of zero risk.</p>
        </div>
        {situation.actors.length === 0 ? (
          <p className="mt-3 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-5 py-6 text-sm text-[#9080a0]">
            No security-sensitive sources recorded.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#2a2a35] bg-[#0f0a1a]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a2a35] text-xs uppercase tracking-wider text-[#9080a0]">
                  <th className="px-4 py-3">Classification</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Evidence</th>
                  <th className="px-4 py-3 text-right">Activity</th>
                  <th className="px-4 py-3">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a35]">
                {situation.actors.slice(0, 30).map((actor) => (
                  <tr key={actor.ip} className="align-top">
                    <td className="px-4 py-3">
                      <span className={`inline-block whitespace-nowrap rounded border px-2 py-1 text-xs ${threatClass(actor.level)}`}>
                        {actor.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#e8dfc8]">
                      {actor.ip}
                      {blocksByIp.get(actor.ip)?.status === "active" && (
                        <span className="mt-1 block w-fit rounded border border-red-800 bg-red-950/30 px-2 py-0.5 font-sans text-[10px] text-red-300">
                          Blocked at Cloudflare
                        </span>
                      )}
                    </td>
                    <td className="min-w-72 px-4 py-3">
                      <p className="text-xs text-[#c8bda8]">{actor.explanation}</p>
                      <p className="mt-1 text-[10px] text-[#6a5a78]">{actor.evidence.join(" · ")}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-[#9080a0]">
                      {actor.events} total
                      <br />
                      {actor.uniquePaths} path{actor.uniquePaths === 1 ? "" : "s"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#9080a0]">
                      {dateTime(actor.lastSeenAt)}
                      <div className="mt-2">
                        {blocksByIp.get(actor.ip)?.status === "active" ? (
                          <form action={unblockIpAction}>
                            <input type="hidden" name="ip" value={actor.ip} />
                            <ConfirmSecurityAction action="unblock" ip={actor.ip} />
                          </form>
                        ) : (
                          <form action={blockIpAction}>
                            <input type="hidden" name="ip" value={actor.ip} />
                            <ConfirmSecurityAction action="block" ip={actor.ip} disabled={!cloudflareConfigured || actor.ip === "Unknown IP"} />
                          </form>
                        )}
                        {blocksByIp.get(actor.ip)?.status === "failed" && (
                          <p className="mt-1 max-w-48 whitespace-normal text-[10px] text-red-300">Block failed: {blocksByIp.get(actor.ip)?.lastError}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {inactiveBlockHistory.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm uppercase tracking-wider text-[#9080a0]">Previous and failed block attempts</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#2a2a35] bg-[#0f0a1a]">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-[#2a2a35] text-xs uppercase tracking-wider text-[#9080a0]"><th className="px-4 py-3">IP</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3">Action</th></tr></thead>
              <tbody className="divide-y divide-[#2a2a35]">
                {inactiveBlockHistory.map((block) => <tr key={block.ip}><td className="px-4 py-3 font-mono text-xs">{block.ip}</td><td className="px-4 py-3 text-xs">{block.status}</td><td className="px-4 py-3 text-xs text-[#9080a0]">{block.source}</td><td className="px-4 py-3 text-xs text-[#9080a0]">{block.reason}{block.lastError ? <span className="block text-red-300">{block.lastError}</span> : null}</td><td className="px-4 py-3 text-xs text-[#9080a0]">{dateTime(block.updatedAt)}</td><td className="px-4 py-3">—</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <h2 className="mt-8 text-sm uppercase tracking-wider text-[#9080a0]">Seven-day totals</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-5 py-4"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#9080a0]">
              <stat.icon size={14} aria-hidden="true" />
              {stat.label}
            </div>
            <p
              className={`mt-2 text-3xl font-semibold ${
                stat.alert ? "text-red-300" : "text-[#e8dfc8]"
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {summary.topOffenderIps.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm uppercase tracking-wider text-[#9080a0]">Most active IPs</h2>
          <div className="mt-3 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] divide-y divide-[#2a2a35]">
            {summary.topOffenderIps.map((offender) => (
              <div key={offender.ip} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-mono text-[#e8dfc8]">{offender.ip}</span>
                <span className="text-[#9080a0]">
                  {offender.events} event{offender.events === 1 ? "" : "s"} · last{" "}
                  {dateTime(offender.lastSeenAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm uppercase tracking-wider text-[#9080a0]">Recent events</h2>
        {events.length === 0 ? (
          <p className="mt-3 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-5 py-6 text-sm text-[#9080a0]">
            Nothing logged in the last {DAYS} days. Quiet is good.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#2a2a35] bg-[#0f0a1a]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a2a35] text-xs uppercase tracking-wider text-[#9080a0]">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">User agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a35]">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[#9080a0]">
                      {dateTime(event.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs ${kindClass(event.kind)}`}
                      >
                        {KIND_LABELS[event.kind] ?? event.kind}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-[#e8dfc8]">
                      {event.ip ?? "—"}
                    </td>
                    <td className="max-w-64 truncate px-4 py-2.5 font-mono text-xs text-[#e8dfc8]">
                      {event.method ? `${event.method} ` : ""}
                      {event.path}
                    </td>
                    <td className="max-w-72 truncate px-4 py-2.5 text-xs text-[#9080a0]">
                      {event.userAgent ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
