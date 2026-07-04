import Link from "next/link";
import {
  Activity,
  Clock3,
  Ear,
  Eye,
  Radio,
  Route,
  Users,
} from "lucide-react";
import { getAnalyticsDashboardData } from "@/lib/analytics";
import { AnalyticsAutoRefresh } from "./AnalyticsAutoRefresh";

export const dynamic = "force-dynamic";

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function duration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function dateTime(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(status: string | null) {
  if (status === "succeeded") return "border-emerald-900 text-emerald-300 bg-emerald-950/30";
  if (status === "running") return "border-amber-800 text-amber-300 bg-amber-950/30";
  if (status === "failed") return "border-red-900 text-red-300 bg-red-950/30";
  return "border-[#2a2a35] text-[#9080a0]";
}

function TrafficChart({
  rows,
}: {
  rows: Array<{ date: string; pageViews: number; visitors: number }>;
}) {
  const width = 900;
  const height = 260;
  const padX = 34;
  const padY = 26;
  const max = Math.max(1, ...rows.flatMap((row) => [row.pageViews, row.visitors]));
  const x = (index: number) => padX + (index / Math.max(1, rows.length - 1)) * (width - padX * 2);
  const y = (value: number) => height - padY - (value / max) * (height - padY * 2);
  const points = (key: "pageViews" | "visitors") =>
    rows.map((row, index) => `${x(index)},${y(row[key])}`).join(" ");
  const labels = rows.length <= 7
    ? rows.map((_, index) => index)
    : [0, Math.floor((rows.length - 1) / 2), rows.length - 1];

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height + 28}`} className="min-w-[42rem] w-full" role="img" aria-label="Page views and visitor trend">
        {[0, 0.25, 0.5, 0.75, 1].map((part) => {
          const gridY = y(max * part);
          return (
            <g key={part}>
              <line x1={padX} x2={width - padX} y1={gridY} y2={gridY} stroke="#2a2a35" strokeWidth="1" />
              <text x="2" y={gridY + 4} fill="#6a5a78" fontSize="11">{Math.round(max * part)}</text>
            </g>
          );
        })}
        <polyline points={points("pageViews")} fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={points("visitors")} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {rows.map((row, index) => (
          <circle key={row.date} cx={x(index)} cy={y(row.pageViews)} r="3" fill="#c4b5fd">
            <title>{row.date}: {row.pageViews} views, {row.visitors} visitors</title>
          </circle>
        ))}
        {labels.map((index) => (
          <text key={index} x={x(index)} y={height + 16} textAnchor="middle" fill="#6a5a78" fontSize="11">
            {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${rows[index].date}T12:00:00`))}
          </text>
        ))}
      </svg>
    </div>
  );
}

function HorizontalBars({
  rows,
}: {
  rows: Array<{ label: string; value: number; detail?: string }>;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-[#6a5a78]">Activity will appear here as the site is used.</p>;
  }
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={`${row.label}-${row.detail ?? ""}`}>
          <div className="mb-1.5 flex items-end justify-between gap-4 text-xs">
            <span className="min-w-0 truncate text-[#c8bda8]" title={row.label}>{row.label}</span>
            <span className="shrink-0 text-[#9080a0]">{number(row.value)}{row.detail ? ` · ${row.detail}` : ""}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#08050f]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#6d28d9] to-[#f59e0b]"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface AnalyticsPageProps {
  searchParams?: Promise<{ days?: string }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const requestedDays = Number(params?.days ?? 30);
  const data = getAnalyticsDashboardData(requestedDays);
  const cards = [
    { label: "Page views", value: number(data.summary.pageViews), icon: Eye, color: "#a78bfa" },
    { label: "Visitors", value: number(data.summary.uniqueVisitors), icon: Users, color: "#60a5fa" },
    { label: "Visits", value: number(data.summary.visits), icon: Route, color: "#2dd4bf" },
    { label: "Engaged minutes", value: number(data.summary.engagedMinutes), icon: Clock3, color: "#f59e0b" },
    { label: "Media plays", value: number(data.summary.mediaPlays), icon: Ear, color: "#f472b6" },
    { label: "Active now", value: number(data.summary.activeNow), icon: Radio, color: "#34d399" },
  ];
  const healthyJobs = data.syncJobs.filter((job) => job.status === "succeeded").length;
  const failedJobs = data.syncJobs.filter((job) => job.status === "failed").length;
  const deviceTotal = Math.max(1, data.devices.reduce((total, device) => total + device.value, 0));
  const deviceColors = ["#8b5cf6", "#f59e0b", "#60a5fa", "#34d399"];
  let deviceCursor = 0;
  const deviceGradient = data.devices.length
    ? `conic-gradient(${data.devices.map((device, index) => {
        const start = deviceCursor;
        deviceCursor += (device.value / deviceTotal) * 100;
        return `${deviceColors[index % deviceColors.length]} ${start}% ${deviceCursor}%`;
      }).join(", ")})`
    : "conic-gradient(#2a2a35 0 100%)";

  return (
    <div className="mx-auto max-w-[96rem]">
      <div className="mb-8">
        <div>
          <h1 className="font-cinzel text-3xl uppercase tracking-widest">Usage & Connections</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#a89880]">
            Signed-in visitor activity, reading and listening engagement, visitor connections, and scheduled content health.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-2">
          <div className="flex rounded-lg bg-[#08050f] p-1">
            {[7, 30, 90].map((days) => (
              <Link
                key={days}
                href={`/admin/analytics?days=${days}`}
                className={`rounded-md px-4 py-2 font-cinzel text-[10px] uppercase tracking-widest transition-colors ${
                  data.days === days ? "bg-[#8b5cf6] text-white" : "text-[#9080a0] hover:text-[#e8dfc8]"
                }`}
              >
                {days} days
              </Link>
            ))}
          </div>
          <AnalyticsAutoRefresh />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-[#9080a0]">{card.label}</span>
                <Icon size={18} style={{ color: card.color }} aria-hidden="true" />
              </div>
              <p className="font-cinzel text-3xl" style={{ color: card.color }}>{card.value}</p>
            </div>
          );
        })}
      </div>

      <section className="mb-6 overflow-hidden rounded-xl border border-[#2a2a35] bg-[#0f0a1a]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-cinzel text-sm uppercase tracking-widest">Who is on now</h2>
            <p className="mt-1 text-xs text-[#6a5a78]">
              Signed-in members and anonymous visitors active within the last two minutes
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900 bg-emerald-950/30 px-3 py-1 text-xs text-emerald-300">
            <i className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {data.activeVisitors.length} active
          </span>
        </div>
        {data.activeVisitors.length > 0 ? (
          <div className="overflow-x-auto border-t border-[#2a2a35]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#08050f] text-[10px] uppercase tracking-widest text-[#6a5a78]">
                <tr>
                  <th className="px-5 py-3 font-normal">Visitor</th>
                  <th className="px-5 py-3 font-normal">Looking at</th>
                  <th className="px-5 py-3 font-normal">Device</th>
                  <th className="px-5 py-3 text-right font-normal">Page views</th>
                  <th className="px-5 py-3 text-right font-normal">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {data.activeVisitors.map((visitor) => (
                  <tr key={visitor.visitor} className="border-t border-[#201927]">
                    <td className="px-5 py-3 font-cinzel text-[10px] tracking-wider text-emerald-300">
                      {visitor.visitor}
                    </td>
                    <td className="px-5 py-3 font-mono text-[#e8dfc8]">{visitor.currentPath}</td>
                    <td className="px-5 py-3 capitalize text-[#9080a0]">{visitor.deviceType}</td>
                    <td className="px-5 py-3 text-right text-[#a89880]">{visitor.pageViews}</td>
                    <td className="px-5 py-3 text-right text-[#9080a0]">{dateTime(visitor.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border-t border-[#2a2a35] px-5 py-8 text-center text-xs text-[#6a5a78]">
            No active visitors right now.
          </p>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-cinzel text-sm uppercase tracking-widest">Traffic over time</h2>
            <p className="mt-1 text-xs text-[#6a5a78]">Daily page views and distinct signed-in members or browsers</p>
          </div>
          <div className="flex gap-5 text-xs text-[#9080a0]">
            <span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#8b5cf6]" />Page views</span>
            <span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#f59e0b]" />Visitors</span>
          </div>
        </div>
        <TrafficChart rows={data.daily} />
      </section>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
          <h2 className="font-cinzel text-sm uppercase tracking-widest">Most visited pages</h2>
          <p className="mb-6 mt-1 text-xs text-[#6a5a78]">Ranked by page views; engagement shows active reading time</p>
          <HorizontalBars rows={data.topPages.map((page) => ({
            label: page.path,
            value: page.pageViews,
            detail: `${duration(page.engagedSeconds)} engaged`,
          }))} />
        </section>

        <section className="rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
          <h2 className="font-cinzel text-sm uppercase tracking-widest">Most read & opened</h2>
          <p className="mb-6 mt-1 text-xs text-[#6a5a78]">Content kept in view or deliberately expanded</p>
          <HorizontalBars rows={data.topContent.map((content) => ({
            label: content.label,
            value: content.views,
            detail: content.type,
          }))} />
        </section>
      </div>

      <section className="mb-6 rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
        <div className="mb-5 flex items-center gap-3">
          <Ear size={20} className="text-[#f472b6]" aria-hidden="true" />
          <div>
            <h2 className="font-cinzel text-sm uppercase tracking-widest">Most listened to & watched</h2>
            <p className="mt-1 text-xs text-[#6a5a78]">Audio, session recordings, and video starts with completion counts</p>
          </div>
        </div>
        <HorizontalBars rows={data.topMedia.map((media) => ({
          label: media.label,
          value: media.plays,
          detail: `${media.completions} completed`,
        }))} />
      </section>

      <div className="mb-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
          <h2 className="font-cinzel text-sm uppercase tracking-widest">Visitor connections</h2>
          <p className="mb-6 mt-1 text-xs text-[#6a5a78]">Device mix and how visitors arrived</p>
          <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <div className="flex items-center gap-6">
              <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: deviceGradient }}>
                <div className="absolute inset-5 grid place-items-center rounded-full bg-[#0f0a1a] font-cinzel text-lg">
                  {number(deviceTotal === 1 && data.devices.length === 0 ? 0 : deviceTotal)}
                </div>
              </div>
              <div className="min-w-0 space-y-2">
                {data.devices.map((device, index) => (
                  <div key={device.label} className="flex items-center gap-2 text-xs text-[#a89880]">
                    <i className="h-2.5 w-2.5 rounded-full" style={{ background: deviceColors[index % deviceColors.length] }} />
                    <span className="capitalize">{device.label}</span>
                    <span className="text-[#6a5a78]">{device.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-widest text-[#6a5a78]">Traffic sources</p>
              <div className="space-y-2">
                {data.referrers.map((source) => (
                  <div key={source.label} className="flex justify-between gap-4 border-b border-[#201927] pb-2 text-xs">
                    <span className="truncate text-[#a89880]">{source.label}</span>
                    <span className="text-[#e8dfc8]">{source.value}</span>
                  </div>
                ))}
                {data.referrers.length === 0 && <p className="text-xs text-[#6a5a78]">No connections recorded yet.</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#2a2a35] bg-[#0f0a1a]">
          <div className="p-5">
            <h2 className="font-cinzel text-sm uppercase tracking-widest">Recent visitors</h2>
            <p className="mt-1 text-xs text-[#6a5a78]">Signed-in visitors are shown by name; no IP addresses or form contents are stored</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-y border-[#2a2a35] bg-[#08050f] text-[10px] uppercase tracking-widest text-[#6a5a78]">
                <tr>
                  <th className="px-5 py-3 font-normal">Visitor</th>
                  <th className="px-5 py-3 font-normal">Last seen</th>
                  <th className="px-5 py-3 font-normal">Entry</th>
                  <th className="px-5 py-3 font-normal">Last page</th>
                  <th className="px-5 py-3 font-normal">Device</th>
                  <th className="px-5 py-3 text-right font-normal">Views</th>
                  <th className="px-5 py-3 text-right font-normal">Engaged</th>
                </tr>
              </thead>
              <tbody>
                {data.recentVisitors.map((visitor, index) => (
                  <tr key={`${visitor.lastSeenAt}-${index}`} className="border-b border-[#201927] last:border-0">
                    <td className="max-w-40 truncate px-5 py-3" title={visitor.visitorEmail ?? undefined}>
                      <span className={visitor.visitorName ? "text-[#e8dfc8]" : "text-[#6a5a78]"}>
                        {visitor.visitorLabel}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-[#9080a0]">{dateTime(visitor.lastSeenAt)}</td>
                    <td className="max-w-36 truncate px-5 py-3 text-[#a89880]">{visitor.entryPath}</td>
                    <td className="max-w-36 truncate px-5 py-3 text-[#e8dfc8]">{visitor.lastPath}</td>
                    <td className="px-5 py-3 capitalize text-[#9080a0]">{visitor.deviceType}</td>
                    <td className="px-5 py-3 text-right">{visitor.pageViews}</td>
                    <td className="px-5 py-3 text-right text-[#f59e0b]">{duration(visitor.engagedSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.recentVisitors.length === 0 && <p className="p-8 text-center text-xs text-[#6a5a78]">New sessions will appear here.</p>}
        </section>
      </div>

      <section className="mb-6 overflow-hidden rounded-xl border border-[#2a2a35] bg-[#0f0a1a]">
        <div className="p-5">
          <h2 className="font-cinzel text-sm uppercase tracking-widest">Who&apos;s been on the site</h2>
          <p className="mt-1 text-xs text-[#6a5a78]">All recorded visitors in the selected period, most recent first</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-y border-[#2a2a35] bg-[#08050f] text-[10px] uppercase tracking-widest text-[#6a5a78]">
              <tr>
                <th className="px-5 py-3 font-normal">Visitor</th>
                <th className="px-5 py-3 font-normal">Email</th>
                <th className="px-5 py-3 font-normal">Last seen</th>
                <th className="px-5 py-3 text-right font-normal">Visits</th>
                <th className="px-5 py-3 text-right font-normal">Pages</th>
                <th className="px-5 py-3 font-normal">Top page</th>
                <th className="px-5 py-3 text-right font-normal">Views</th>
                <th className="px-5 py-3 text-right font-normal">Engaged</th>
              </tr>
            </thead>
            <tbody>
              {data.people.map((person) => (
                <tr key={person.visitorKey} className="border-b border-[#201927] last:border-0">
                  <td className="px-5 py-3 text-[#e8dfc8]">{person.name}</td>
                  <td className="max-w-56 truncate px-5 py-3 text-[#9080a0]">{person.email ?? "Anonymous"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-[#9080a0]">{dateTime(person.lastSeenAt)}</td>
                  <td className="px-5 py-3 text-right">{person.sessions}</td>
                  <td className="px-5 py-3 text-right">{person.pagesViewed}</td>
                  <td className="max-w-52 truncate px-5 py-3 font-mono text-[#a89880]" title={person.topPage}>{person.topPage || "—"}</td>
                  <td className="px-5 py-3 text-right">{person.pageViews}</td>
                  <td className="px-5 py-3 text-right text-[#f59e0b]">{duration(person.engagedSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.people.length === 0 && (
          <p className="p-8 text-center text-xs text-[#6a5a78]">
            Visitors will appear here after they browse the site.
          </p>
        )}
      </section>

      <div className="mb-6 grid gap-6 2xl:grid-cols-[1.35fr_0.65fr]">
        <section className="overflow-hidden rounded-xl border border-[#2a2a35] bg-[#0f0a1a]">
          <div className="p-5">
            <h2 className="font-cinzel text-sm uppercase tracking-widest">What each visitor viewed</h2>
            <p className="mt-1 text-xs text-[#6a5a78]">Signed-in and anonymous visitor activity, most recent first</p>
          </div>
          <div className="max-h-[38rem] overflow-auto border-t border-[#2a2a35]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#08050f] text-[10px] uppercase tracking-widest text-[#6a5a78]">
                <tr>
                  <th className="px-5 py-3 font-normal">Visitor</th>
                  <th className="px-5 py-3 font-normal">Page</th>
                  <th className="px-5 py-3 text-right font-normal">Views</th>
                  <th className="px-5 py-3 text-right font-normal">Engaged</th>
                  <th className="px-5 py-3 font-normal">Last viewed</th>
                </tr>
              </thead>
              <tbody>
                {data.memberPageActivity.map((activity) => (
                  <tr key={`${activity.visitorKey}-${activity.path}`} className="border-t border-[#201927]">
                    <td className="max-w-44 truncate px-5 py-3" title={activity.email ?? activity.name}>
                      <span className="text-[#e8dfc8]">{activity.name}</span>
                    </td>
                    <td className="max-w-72 px-5 py-3" title={activity.path}>
                      <p className="truncate text-[#c8bda8]">{activity.pageLabel}</p>
                      <p className="truncate font-mono text-[10px] text-[#6a5a78]">{activity.path}</p>
                    </td>
                    <td className="px-5 py-3 text-right">{activity.pageViews}</td>
                    <td className="px-5 py-3 text-right text-[#f59e0b]">{duration(activity.engagedSeconds)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-[#9080a0]">{dateTime(activity.lastViewedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.memberPageActivity.length === 0 && (
              <p className="p-8 text-center text-xs text-[#6a5a78]">Visitor page activity will appear here.</p>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#2a2a35] bg-[#0f0a1a]">
          <div className="p-5">
            <h2 className="font-cinzel text-sm uppercase tracking-widest">Who viewed each page</h2>
            <p className="mt-1 text-xs text-[#6a5a78]">Signed-in and anonymous visitors for each page</p>
          </div>
          <div className="max-h-[38rem] overflow-auto border-t border-[#2a2a35]">
            {data.pageAudiences.map((page) => (
              <div key={page.path} className="border-b border-[#201927] p-5 last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-[#e8dfc8]" title={page.path}>{page.pageLabel}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-[#6a5a78]">{page.path}</p>
                  </div>
                  <span className="shrink-0 text-xs text-[#a78bfa]">{page.people} {page.people === 1 ? "visitor" : "visitors"}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#a89880]">{page.visitorNames.join(", ")}</p>
                <p className="mt-2 text-[10px] text-[#6a5a78]">{page.pageViews} views · last {dateTime(page.lastViewedAt)}</p>
              </div>
            ))}
            {data.pageAudiences.length === 0 && (
              <p className="p-8 text-center text-xs text-[#6a5a78]">Page audiences will appear after visitors browse the site.</p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[#2a2a35] bg-[#0f0a1a]">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="font-cinzel text-sm uppercase tracking-widest">Automations & source connections</h2>
            <p className="mt-1 text-xs text-[#6a5a78]">When jobs run, their status, duration, and next scheduled connection</p>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="rounded-full border border-emerald-900 bg-emerald-950/30 px-3 py-1 text-emerald-300">{healthyJobs} healthy</span>
            <span className={`rounded-full border px-3 py-1 ${failedJobs ? "border-red-900 bg-red-950/30 text-red-300" : "border-[#2a2a35] text-[#6a5a78]"}`}>{failedJobs} failed</span>
          </div>
        </div>
        <div className="grid border-t border-[#2a2a35] xl:grid-cols-2">
          <div className="border-b border-[#2a2a35] p-5 xl:border-b-0 xl:border-r">
            <p className="mb-4 text-[10px] uppercase tracking-widest text-[#6a5a78]">Connection status</p>
            <div className="space-y-3">
              {data.syncJobs.map((job) => (
                <div key={job.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#201927] bg-[#08050f] p-3">
                  <Activity size={15} className="text-[#8b5cf6]" aria-hidden="true" />
                  <span className="min-w-40 flex-1 text-xs text-[#e8dfc8]">{job.label}</span>
                  <span className={`rounded border px-2 py-0.5 text-[9px] uppercase tracking-widest ${statusClass(job.status)}`}>
                    {job.status ?? "Pending"}
                  </span>
                  <span className="w-full pl-7 text-[10px] text-[#6a5a78]">
                    Last: {dateTime(job.lastFinishedAt ?? job.lastStartedAt)} · Next: {dateTime(job.nextRunAt)}
                    {job.durationMs ? ` · ${duration(Math.round(job.durationMs / 1000))}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5">
            <p className="mb-4 text-[10px] uppercase tracking-widest text-[#6a5a78]">Recent run history</p>
            <div className="space-y-3">
              {data.recentSyncRuns.map((run) => (
                <div key={run.id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-[#201927] pb-3 text-xs last:border-0">
                  <div>
                    <p className="text-[#c8bda8]">{run.label}</p>
                    <p className="mt-1 truncate text-[10px] text-[#6a5a78]" title={run.message ?? undefined}>
                      {dateTime(run.startedAt)}{run.message ? ` · ${run.message}` : ""}
                    </p>
                  </div>
                  <span className={`self-start rounded border px-2 py-0.5 text-[9px] uppercase tracking-widest ${statusClass(run.status)}`}>
                    {run.status}{run.durationMs ? ` · ${duration(Math.round(run.durationMs / 1000))}` : ""}
                  </span>
                </div>
              ))}
              {data.recentSyncRuns.length === 0 && <p className="py-8 text-center text-xs text-[#6a5a78]">No scheduled runs recorded yet.</p>}
            </div>
          </div>
        </div>
      </section>

      <p className="mt-5 text-xs leading-relaxed text-[#5a5060]">
        Analytics collection began when this screen was installed; earlier site traffic cannot be reconstructed. A visit resets after 30 minutes without activity. Signed-in activity is attributed to the member&apos;s name and email; no passwords, IP addresses, or page contents are stored.
      </p>
    </div>
  );
}
