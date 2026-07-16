import { KeyRound, Radar, ShieldAlert } from "lucide-react";
import { getRecentSecurityEvents, getSecuritySummary } from "@/lib/securityLog";

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
  const events = getRecentSecurityEvents({ days: DAYS, limit: 200 });

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
    <div className="max-w-5xl">
      <h1 className="font-cinzel text-2xl text-[#e8dfc8]">Security</h1>
      <p className="mt-1 text-sm text-[#9080a0]">
        Failed admin logins and suspicious requests from the last {DAYS} days. Scanner probes are
        background internet noise unless one IP keeps coming back; failed logins deserve a look.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
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
