"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";

export type Cell = string | number | null | undefined;
export type ReportRow = Record<string, Cell>;
export type Column = { key: string; label: string; format?: "number" | "seconds" | "date" | "percent" | "ms"; hrefKey?: string };
export function formatCell(value: Cell, format?: Column["format"]) {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "date") return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(String(value)));
  if (format === "seconds") {
    const seconds = Math.round(Number(value));
    return seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
  }
  if (format === "percent") return `${value}%`;
  if (format === "ms") return Number(value) < 1000 ? `${Math.round(Number(value))}ms` : `${(Number(value) / 1000).toFixed(1)}s`;
  return typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : value;
}

export function ReportTable({ title, description, columns, rows, initialSize = 10 }: {
  title: string; description?: string; columns: Column[]; rows: ReportRow[]; initialSize?: number;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; ascending: boolean } | null>(null);
  const filtered = useMemo(() => {
    const items = rows.filter((row) => columns.some((column) => String(row[column.key] ?? "").toLowerCase().includes(query.toLowerCase())));
    if (sort) items.sort((a, b) => {
      const av = a[sort.key] ?? "", bv = b[sort.key] ?? "";
      return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true })) * (sort.ascending ? 1 : -1);
    });
    return items;
  }, [rows, columns, query, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / initialSize));
  const current = Math.min(page, pages - 1);
  return <section aria-labelledby={id} className="min-w-0 overflow-hidden rounded-xl border border-[#2a2a35] bg-[#0f0a1a]">
    <div className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div><h2 id={id} className="font-cinzel text-sm tracking-wider text-[#e8dfc8]">{title}</h2>
        {description && <p className="mt-2 max-w-3xl text-xs leading-5 text-[#a89880]">{description}</p>}</div>
      <label className="text-xs text-[#a89880]">Filter {title.toLowerCase()}
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} type="search"
          className="mt-1 block w-52 max-w-full rounded border border-[#493957] bg-[#08050f] px-3 py-2 text-sm text-[#e8dfc8] focus:outline-violet-400" /></label>
    </div>
    <div className="overflow-x-auto" role="region" aria-label={`${title} table`} tabIndex={0}>
      <table className="w-full text-left text-xs"><caption className="sr-only">{title}</caption>
        <thead className="border-y border-[#2a2a35] bg-[#08050f] text-[#baacc8]"><tr>{columns.map((column) =>
          <th key={column.key} scope="col" aria-sort={sort?.key === column.key ? sort.ascending ? "ascending" : "descending" : "none"} className="whitespace-nowrap px-4 py-3 font-normal">
            <button className="rounded text-left hover:text-amber-300 focus-visible:outline-violet-400" onClick={() => { setSort({ key: column.key, ascending: sort?.key === column.key ? !sort.ascending : !column.format }); setPage(0); }}>
              {column.label}{sort?.key === column.key ? sort.ascending ? " ↑" : " ↓" : " ↕"}
            </button></th>)}</tr></thead>
        <tbody>{filtered.slice(current * initialSize, (current + 1) * initialSize).map((row, index) =>
          <tr key={index} className="border-b border-[#241b30] align-top last:border-0 hover:bg-[#191024]">{columns.map((column) =>
            <td key={column.key} className={`px-4 py-3 leading-5 ${column.format ? "whitespace-nowrap tabular-nums text-[#e8dfc8]" : "min-w-28 max-w-sm break-words text-[#c8bda8]"}`}>
              {column.hrefKey && row[column.hrefKey] ? <Link className="text-violet-300 underline decoration-violet-500/40 underline-offset-4 hover:text-amber-300" href={String(row[column.hrefKey])}>{formatCell(row[column.key], column.format)}</Link> : formatCell(row[column.key], column.format)}
            </td>)}</tr>)}</tbody>
      </table>
      {!filtered.length && <p className="p-8 text-center text-sm text-[#a89880]">{rows.length ? "No matching records. Clear the filter to see all records." : "No recorded activity for this selection."}</p>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2a2a35] px-5 py-3 text-xs text-[#a89880]">
      <span aria-live="polite">{filtered.length ? `${current * initialSize + 1}–${Math.min((current + 1) * initialSize, filtered.length)}` : "0"} of {filtered.length.toLocaleString()} records{query ? ` (${rows.length.toLocaleString()} total)` : ""}</span>
      <div className="flex items-center gap-3"><button disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded border border-[#493957] px-3 py-1.5 disabled:opacity-40">Previous</button>
        <span>{current + 1} / {pages}</span><button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)} className="rounded border border-[#493957] px-3 py-1.5 disabled:opacity-40">Next</button></div>
    </div>
  </section>;
}
