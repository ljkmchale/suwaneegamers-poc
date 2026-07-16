"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HistoryData, HistoryEra, HistoryTable } from "@/lib/history";

function HistoryDataTable({ table }: { table: HistoryTable }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20">
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead>
          <tr className="bg-amber-400/[0.07]">
            {table.headers.map((header) => (
              <th key={header} className="font-cinzel border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.2em] text-amber-300">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${row[0] ?? "row"}-${rowIndex}`} className="border-b border-white/[0.07] last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={`${cellIndex}-${cell.slice(0, 16)}`} className={`px-4 py-3 align-top leading-relaxed ${cellIndex === 0 ? "w-32 font-medium text-white" : "text-white/70"}`}>
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

function yearRange(era: HistoryEra) {
  const first = era.years.rows[0]?.[0] ?? "Age";
  const last = era.years.rows.at(-1)?.[0] ?? "";
  return last && last !== first ? `${first} – ${last}` : first;
}

function Timeline({ eras }: { eras: HistoryEra[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const selected = eras[selectedIndex];

  useEffect(() => {
    const item = stripRef.current?.querySelector<HTMLElement>(`[data-timeline-index="${selectedIndex}"]`);
    item?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedIndex]);

  const select = (index: number) => setSelectedIndex(Math.max(0, Math.min(eras.length - 1, index)));
  const move = (direction: -1 | 1) => select(selectedIndex + direction);

  return (
    <section aria-label="Myrdae historical ages" className="w-full overflow-hidden border-y border-white/10 bg-[#080716]/90 shadow-[0_12px_35px_rgba(0,0,0,.3)]">
      <div className="px-4 pb-2 pt-7 text-center sm:px-8">
        <p className="font-cinzel text-[0.65rem] uppercase tracking-[0.42em] text-violet-300">Myrdae Timeline</p>
        <h2 className="font-cinzel mt-2 text-xl uppercase tracking-[0.2em] text-white sm:text-2xl">Ages of Myrdae</h2>
      </div>

      <div className="relative px-12 pb-7 pt-5 sm:px-16 lg:px-20">
        <button type="button" onClick={() => move(-1)} disabled={selectedIndex === 0} aria-label="Select previous historical age" className="absolute left-2 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/80 text-white transition hover:border-amber-300 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-30 sm:left-4">
          <ChevronLeft aria-hidden="true" size={19} />
        </button>
        <button type="button" onClick={() => move(1)} disabled={selectedIndex === eras.length - 1} aria-label="Select next historical age" className="absolute right-2 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/80 text-white transition hover:border-amber-300 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-30 sm:right-4">
          <ChevronRight aria-hidden="true" size={19} />
        </button>

        <div ref={stripRef} role="tablist" aria-label="Select a historical age" className="history-scrollbar relative flex snap-x snap-mandatory justify-start gap-7 overflow-x-auto px-1 pb-8 pt-2 lg:justify-around lg:gap-10">
          <span aria-hidden="true" className="pointer-events-none absolute bottom-[3.75rem] left-1 right-1 h-px bg-gradient-to-r from-white/10 via-white/45 to-white/10" />
          {eras.map((era, index) => {
            const active = selectedIndex === index;
            return (
              <button key={era.id} type="button" role="tab" aria-selected={active} aria-controls="selected-history-era" id={`history-tab-${era.id}`} data-timeline-index={index} onClick={() => select(index)} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); } if (event.key === "ArrowRight") { event.preventDefault(); move(1); } }} className="group relative z-10 w-[8.5rem] shrink-0 snap-center text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 sm:w-[10rem] xl:w-[11rem]">
                <span className={`relative mx-auto block aspect-[2/3] w-full overflow-hidden bg-transparent shadow-xl transition duration-300 ${active ? "-translate-y-1 drop-shadow-[0_0_14px_rgba(245,158,11,.42)]" : "opacity-65 group-hover:opacity-100"}`}>
                  <Image src={era.imageUrl} alt={`Fantasy sourcebook cover representing ${era.title}`} fill sizes="(max-width: 640px) 136px, (max-width: 1280px) 160px, 176px" className="object-contain transition duration-300 group-hover:scale-[1.025]" />
                </span>
                <span className={`font-cinzel mt-3 block min-h-[2.5rem] text-sm uppercase leading-tight tracking-[0.08em] transition ${active ? "text-white" : "text-white/70 group-hover:text-white/90"}`}>{era.title}</span>
                <span className={`font-cinzel mt-1 block text-xs uppercase tracking-wider transition ${active ? "text-amber-200" : "text-white/50"}`}>{yearRange(era)}</span>
                <span className={`relative z-10 mx-auto mt-3 block h-3 w-3 rounded-full border transition ${active ? "scale-125 border-white bg-[#080716] shadow-[0_0_14px_rgba(255,255,255,.45)]" : "border-white/55 bg-[#080716]"}`} aria-hidden="true" />
                <span aria-hidden="true" className={`mx-auto mt-2 block h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent transition ${active ? "border-t-red-500 opacity-100" : "border-t-transparent opacity-0"}`} />
                <span className="sr-only">{era.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div id="selected-history-era" role="tabpanel" aria-labelledby={`history-tab-${selected.id}`} tabIndex={0} key={selected.id} className="history-panel-enter border-t border-white/10 bg-gradient-to-br from-violet-950/30 via-[#0b0918] to-black/50 px-5 py-7 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-300 sm:px-10 sm:py-9 lg:px-[max(5rem,calc((100vw-96rem)/2))]">
        <p className="font-cinzel text-xs uppercase tracking-[0.3em] text-amber-300">{yearRange(selected)}</p>
        <h3 className="font-cinzel mt-2 text-2xl text-white sm:text-3xl">{selected.title}</h3>
        {selected.description && <p className="mt-4 max-w-4xl text-sm leading-7 text-white/75 sm:text-base">{selected.description}</p>}
        <div className="mt-7"><HistoryDataTable table={selected.years} /></div>
      </div>
    </section>
  );
}

export function HistorySourceView({ data }: { data: HistoryData }) {
  return (
    <div className="w-full">
      <Timeline eras={data.eras} />
      <style jsx global>{`
        .history-scrollbar { scrollbar-color: rgba(245, 158, 11, .45) rgba(255, 255, 255, .06); scrollbar-width: thin; }
        .history-panel-enter { animation: history-panel-in 240ms ease-out; }
        @keyframes history-panel-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .history-panel-enter { animation: none; } .history-scrollbar { scroll-behavior: auto; } }
      `}</style>
    </div>
  );
}
