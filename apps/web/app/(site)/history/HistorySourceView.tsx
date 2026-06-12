"use client";

import { useState } from "react";
import type { HistoryData, HistoryEra, HistoryTable } from "@/lib/history";

function HistoryDataTable({ table }: { table: HistoryTable }) {
  return (
    <div
      className="overflow-x-auto rounded-lg border"
      style={{ borderColor: "var(--color-bg-border)" }}
    >
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead>
          <tr style={{ background: "rgba(245,158,11,.08)" }}>
            {table.headers.map((header) => (
              <th
                key={header}
                className="font-cinzel px-4 py-3 text-xs uppercase tracking-[0.2em]"
                style={{
                  color: "var(--color-accent-gold)",
                  borderBottom: "1px solid var(--color-bg-border)",
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr
              key={`${row[0] ?? "row"}-${rowIndex}`}
              style={rowIndex < table.rows.length - 1 ? { borderBottom: "1px solid var(--color-bg-border)" } : undefined}
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={`${cellIndex}-${cell.slice(0, 16)}`}
                  className="px-4 py-3 align-top leading-relaxed"
                  style={{
                    color: cellIndex === 0 ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    width: cellIndex === 0 ? "8rem" : undefined,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EraFold({ era }: { era: HistoryEra }) {
  const [isOpen, setIsOpen] = useState(false);
  const firstYear = era.years.rows[0]?.[0] ?? "";
  const lastYear = era.years.rows.at(-1)?.[0] ?? "";

  return (
    <section className="py-2">
      <div className="fantasy-card overflow-hidden">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="w-full cursor-pointer px-6 py-5 text-left"
        >
          <div className="flex items-center justify-between gap-5">
            <div className="min-w-0">
              <p
                className="font-cinzel mb-1 text-[0.65rem] uppercase tracking-[0.35em]"
                style={{ color: "var(--color-accent-arcane)" }}
              >
                {firstYear && lastYear ? `${firstYear} to ${lastYear}` : "Historical Age"}
              </p>
              <h2
                className="font-cinzel text-xl uppercase tracking-widest"
                style={{ color: "var(--color-text-primary)" }}
              >
                {era.title}
              </h2>
              {era.description && (
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {era.description}
                </p>
              )}
            </div>
            <span
              className="font-cinzel inline-flex shrink-0 items-center gap-2 text-xs uppercase tracking-widest"
              style={{ color: "var(--color-accent-gold)" }}
            >
              Open Years
              <span className="text-base" aria-hidden="true">
                {isOpen ? "-" : "+"}
              </span>
            </span>
          </div>
        </button>

        {isOpen && (
          <div
            className="border-t px-6 py-5"
            style={{ borderColor: "var(--color-bg-border)" }}
          >
            <HistoryDataTable table={era.years} />
          </div>
        )}
      </div>
    </section>
  );
}

function TimelineStrip({ eras }: { eras: HistoryEra[] }) {
  const accents = [
    "var(--color-accent-arcane)",
    "var(--color-accent-gold)",
    "var(--color-accent-ice)",
    "var(--color-accent-blood)",
  ];

  const label = (era: HistoryEra, accent: string) => {
    const startYear = era.years.rows[0]?.[0] ?? "Age";
    const endYear = era.years.rows.at(-1)?.[0] ?? "";

    return (
      <div className="text-center">
        <p className="font-cinzel text-[0.65rem] uppercase tracking-[0.28em]" style={{ color: accent }}>
          {endYear ? `${startYear} - ${endYear}` : startYear}
        </p>
        <h3 className="mt-1 font-cinzel text-sm leading-tight" style={{ color: "var(--color-text-primary)" }}>
          {era.title}
        </h3>
      </div>
    );
  };

  return (
    <div
      className="fantasy-card overflow-hidden p-5 md:p-7"
      style={{
        boxShadow: "0 18px 55px rgba(0,0,0,.34)",
      }}
    >
      <div className="mb-8 text-center">
        <p
          className="font-cinzel text-xs uppercase tracking-[0.35em]"
          style={{ color: "var(--color-accent-arcane)" }}
        >
          Myrdae Timeline
        </p>
        <h2
          className="font-cinzel mt-2 text-2xl uppercase tracking-widest"
          style={{ color: "var(--color-accent-gold)" }}
        >
          Ages of Myrdae
        </h2>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="relative grid min-w-[58rem] grid-rows-[minmax(4.5rem,auto)_4rem_minmax(4.5rem,auto)] px-5">
          <div
            className="absolute left-8 right-8 top-1/2 h-2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--color-accent-arcane), var(--color-accent-gold), var(--color-accent-ice), var(--color-accent-blood))",
              boxShadow: "0 0 26px rgba(245,158,11,.18)",
            }}
            aria-hidden="true"
          />
          <div
            className="col-start-1 row-start-1 grid"
            style={{ gridTemplateColumns: `repeat(${eras.length}, minmax(9rem, 1fr))` }}
          >
            {eras.map((era, index) => {
              const accent = accents[index % accents.length];
              return index % 2 === 0 ? (
                <div key={`${era.id}-top`} className="px-2 pb-4">
                  {label(era, accent)}
                </div>
              ) : (
                <div key={`${era.id}-top`} />
              );
            })}
          </div>
          <div
            className="relative col-start-1 row-start-2 grid"
            style={{ gridTemplateColumns: `repeat(${eras.length}, minmax(9rem, 1fr))` }}
          >
            {eras.map((era, index) => {
              const accent = accents[index % accents.length];
              const top = index % 2 === 0;
              const date = era.years.rows[0]?.[0] ?? String(index + 1);
              const marker = date.includes("PF") ? "PF" : date.match(/\d+/)?.[0] ?? String(index + 1);
              return (
                <div key={`${era.id}-node`} className="relative flex items-center justify-center">
                  <span
                    className={`absolute h-8 w-px ${top ? "bottom-1/2" : "top-1/2"}`}
                    style={{ background: accent }}
                    aria-hidden="true"
                  />
                  <span
                    className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 font-cinzel text-[0.62rem] shadow-xl"
                    style={{
                      borderColor: accent,
                      background: "var(--color-bg-deep)",
                      color: accent,
                      boxShadow: `0 0 24px color-mix(in srgb, ${accent} 32%, transparent)`,
                    }}
                    aria-label={date}
                  >
                    {marker}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            className="col-start-1 row-start-3 grid"
            style={{ gridTemplateColumns: `repeat(${eras.length}, minmax(9rem, 1fr))` }}
          >
            {eras.map((era, index) => {
              const accent = accents[index % accents.length];
              return index % 2 === 0 ? (
                <div key={`${era.id}-bottom`} />
              ) : (
                <div key={`${era.id}-bottom`} className="px-2 pt-4">
                  {label(era, accent)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistorySourceView({ data }: { data: HistoryData }) {
  return (
    <div className="space-y-10">
      <section>
        <div className="mb-6 text-center">
          {data.chronologyIntro.map((paragraph) => (
            <p
              key={paragraph.slice(0, 32)}
              className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {paragraph}
            </p>
          ))}
        </div>

        <TimelineStrip eras={data.eras} />

        <div className="mt-8">
          {data.eras.map((era) => (
            <EraFold key={era.id} era={era} />
          ))}
        </div>
      </section>

    </div>
  );
}
