"use client";
import { useMemo, useState } from "react";
import type { MyraHealthStatus } from "@/lib/myraHealth";

const colors = { healthy: "#22c55e", degraded: "#f59e0b", unavailable: "#ef4444", unknown: "#94a3b8" } as const;
export function MyraHealthPanel({ initial }: { initial: MyraHealthStatus }) {
  const [health, setHealth] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [service, setService] = useState("all");
  const [severity, setSeverity] = useState("all");
  async function run(depth?: "quick" | "full") {
    setBusy(true);
    try {
      const response = depth ? await fetch("/api/myra/health/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ depth }) }) : await fetch("/api/myra/health", { cache: "no-store" });
      if (!response.ok) throw new Error((await response.json()).error ?? "Diagnostic failed");
      setHealth(await response.json());
    } catch (error) { window.alert(error instanceof Error ? error.message : "Diagnostic failed"); }
    finally { setBusy(false); }
  }
  const incidents = useMemo(() => health.activeIncidents.filter((i) => (service === "all" || i.service === service) && (severity === "all" || i.severity === severity)), [health, service, severity]);
  const updateKinds = ["content", "image", "file"] as const;
  return <div className="space-y-6">
    <section className="rounded-xl border border-[#30243d] bg-[#120d1b] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ background: colors[health.overallStatus] }} /><h1 className="font-cinzel text-2xl text-[#e8dfc8]">Myra Health</h1></div><p className="mt-2 max-w-3xl text-sm text-[#b9abc8]">{health.summary}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => run("quick")} className="rounded bg-[#5b21b6] px-3 py-2 text-sm disabled:opacity-50">Run Quick Check</button><button disabled={busy} onClick={() => run("full")} className="rounded bg-[#9a3412] px-3 py-2 text-sm disabled:opacity-50">Run Full Diagnostic</button><button disabled={busy} onClick={() => run()} className="rounded border border-[#50405f] px-3 py-2 text-sm disabled:opacity-50">Refresh</button></div></div>
      <div className="mt-5 grid gap-3 text-xs sm:grid-cols-4"><p>Checked<br/><span className="text-[#e8dfc8]">{new Date(health.checkedAt).toLocaleString()}</span></p><p>Uptime<br/><span className="text-[#e8dfc8]">{Math.round(health.uptime / 60)} minutes</span></p><p>Version<br/><span className="text-[#e8dfc8]">{health.version}</span></p><p>Environment<br/><span className="text-[#e8dfc8]">{health.environment}</span></p></div>
    </section>
    <section className="rounded-xl border border-[#30243d] bg-[#120d1b] p-6">
      <h2 className="font-cinzel text-xl">Website updates</h2>
      <p className="mt-2 text-sm text-[#b9abc8]">
        {health.websiteUpdates.updatedToday
          ? `${health.websiteUpdates.todayCount} website items were updated today.`
          : health.websiteUpdates.latestUpdate
            ? `Nothing was updated today. The latest update was ${new Date(health.websiteUpdates.latestUpdate.updatedAt).toLocaleString()}.`
            : "No website update timestamps are available."}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {updateKinds.map((kind) => {
          const category = health.websiteUpdates.categories[kind];
          return <article key={kind} className="rounded border border-[#352a40] p-3 text-sm">
            <h3 className="capitalize text-[#e8dfc8]">{kind === "file" ? "Website files" : `${kind}s`}</h3>
            <p className="mt-1 text-[#b9abc8]">{category.todayCount} updated today</p>
            <p className="mt-2 break-words text-xs text-[#786987]">
              {category.latestUpdate
                ? `Latest: ${category.latestUpdate.name} at ${new Date(category.latestUpdate.updatedAt).toLocaleString()}`
                : "No updates recorded"}
            </p>
          </article>;
        })}
      </div>
    </section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{health.diagnostics.map((item) => <article key={item.service} className="rounded-lg border border-[#30243d] bg-[#120d1b] p-4"><div className="flex items-center justify-between gap-3"><h2 className="font-medium">{item.displayName}</h2><span className="rounded px-2 py-1 text-xs uppercase" style={{ color: colors[item.status], background: `${colors[item.status]}18` }}>{item.status}</span></div><p className="mt-2 text-sm text-[#b9abc8]">{item.message}</p><p className="mt-2 text-xs text-[#786987]">{item.responseTimeMs == null ? "No timing" : `${item.responseTimeMs} ms`}</p>{item.technicalDetails && <details className="mt-3 text-xs"><summary className="cursor-pointer text-[#a78bfa]">Technical details</summary><p className="mt-2 break-words text-[#9b8aaa]">{item.technicalDetails}</p></details>}</article>)}</section>
    <section className="rounded-xl border border-[#30243d] bg-[#120d1b] p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-cinzel text-xl">Active incidents</h2><div className="flex gap-2"><select value={service} onChange={(e) => setService(e.target.value)} className="rounded border border-[#50405f] bg-[#0b0711] px-2 py-1 text-xs"><option value="all">All services</option>{health.diagnostics.map((d) => <option key={d.service} value={d.service}>{d.displayName}</option>)}</select><select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded border border-[#50405f] bg-[#0b0711] px-2 py-1 text-xs"><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select></div></div>{incidents.length ? <div className="mt-4 space-y-3">{incidents.map((incident) => <div key={incident.id} className="rounded border border-[#352a40] p-3 text-sm"><div className="flex justify-between"><strong>{incident.service}</strong><span className="uppercase" style={{ color: incident.severity === "critical" ? colors.unavailable : colors.degraded }}>{incident.severity}</span></div><p className="mt-1 text-[#b9abc8]">{incident.summary}</p><p className="mt-1 text-xs text-[#786987]">Started {new Date(incident.startedAt).toLocaleString()}</p></div>)}</div> : <p className="mt-4 text-sm text-[#786987]">No active incidents match these filters.</p>}</section>
    <section className="rounded-xl border border-[#30243d] bg-[#120d1b] p-6"><h2 className="font-cinzel text-xl">Recently resolved</h2><div className="mt-4 space-y-2">{health.incidentHistory.filter((incident) => incident.status === "resolved").slice(0, 20).map((incident) => <details key={incident.id} className="rounded border border-[#352a40] p-3 text-sm"><summary className="cursor-pointer"><span className="text-[#22c55e]">Resolved</span> · {incident.service} · {incident.summary}</summary><p className="mt-2 text-xs text-[#8d7c9d]">{incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : "Resolution time unavailable"}{incident.resolution ? ` — ${incident.resolution}` : ""}</p></details>)}</div></section>
  </div>;
}
