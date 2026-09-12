"use client";

import { useState } from "react";
import { ReportTable } from "./ReportTable";

type Day = { date: string; pageViews: number; visitors: number; engagedSeconds: number; mediaPlays: number };
const metrics = { visitors: "Recorded visitors", pageViews: "Page views", engagedSeconds: "Engaged minutes", mediaPlays: "Media plays" };
export function TrafficChart({ rows }: { rows: Day[] }) {
  const [metric, setMetric] = useState<keyof typeof metrics>("visitors");
  const [selected, setSelected] = useState<number | null>(null);
  const values = rows.map((row) => metric === "engagedSeconds" ? Math.round(row[metric] / 60) : row[metric]);
  const max = Math.max(1, ...values);
  const x = (i: number) => 55 + i * 780 / Math.max(1, rows.length - 1);
  const y = (v: number) => 205 - v / max * 175;
  const index = Math.min(selected ?? rows.length - 1, rows.length - 1);
  return <section className="min-w-0 rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-cinzel text-sm tracking-wider">Traffic over time</h2>
      <label className="text-xs text-[#a89880]">Measure <select className="ml-2 rounded border border-[#493957] bg-[#08050f] px-3 py-2 text-[#e8dfc8]" value={metric} onChange={(e) => setMetric(e.target.value as keyof typeof metrics)}>{Object.entries(metrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
    <p className="mt-2 text-xs text-[#a89880]">Daily counts. Today is incomplete; earlier unrecorded activity cannot be reconstructed.</p>
    <svg viewBox="0 0 875 245" className="mt-4 w-full" role="img" aria-label={`${metrics[metric]} by day. Exact values are available below.`}>
      {[0, 0.5, 1].map((part) => <g key={part}><line x1="55" x2="835" y1={y(max * part)} y2={y(max * part)} stroke="#33253f" /><text x="5" y={y(max * part) + 4} fill="#baacc8" fontSize="12">{Math.round(max * part)}</text></g>)}
      <polyline fill="none" stroke="#a78bfa" strokeWidth="3" points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      {values.map((v, i) => <circle key={rows[i].date} cx={x(i)} cy={y(v)} r={index === i ? 6 : 3} fill={index === i ? "#f59e0b" : "#c4b5fd"} onMouseEnter={() => setSelected(i)}><title>{`${rows[i].date}: ${v} ${metrics[metric]}`}</title></circle>)}
      {[0, Math.floor((rows.length - 1) / 2), rows.length - 1].filter((v, i, a) => v >= 0 && a.indexOf(v) === i).map((i) => <text key={i} x={x(i)} y="236" textAnchor="middle" fill="#baacc8" fontSize="12">{rows[i].date.slice(5)}</text>)}
    </svg>
    {rows.length > 0 && <label className="block text-xs text-[#c8bda8]">Inspect day: <span aria-live="polite">{rows[index].date} · {values[index]} {metrics[metric].toLowerCase()}</span>
      <input className="mt-3 block w-full accent-violet-400" type="range" min={0} max={rows.length - 1} value={index} onChange={(e) => setSelected(Number(e.target.value))} aria-label="Inspect traffic by day" aria-valuetext={`${rows[index].date}: ${values[index]} ${metrics[metric]}`} /></label>}
    <details className="mt-5"><summary className="cursor-pointer text-sm text-violet-300">View daily data</summary><div className="mt-4"><ReportTable title="Daily traffic" columns={[{ key: "date", label: "Date" }, { key: "visitors", label: "Visitors", format: "number" }, { key: "pageViews", label: "Views", format: "number" }, { key: "engagedSeconds", label: "Engaged", format: "seconds" }, { key: "mediaPlays", label: "Plays", format: "number" }]} rows={rows} /></div></details>
  </section>;
}
