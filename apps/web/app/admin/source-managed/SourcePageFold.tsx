"use client";

import { useState, type ReactNode } from "react";

interface SourcePageFoldProps {
  children: ReactNode;
  generated?: boolean;
  label: string;
  notInNav: boolean;
  path: string;
}

export function SourcePageFold({
  children,
  generated = false,
  label,
  notInNav,
  path,
}: SourcePageFoldProps) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-lg border border-[#5b3f11] bg-[#0f0a1a]">
      <div className="flex items-center justify-between gap-4 p-5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex items-start gap-3">
            <span className="mt-0.5 font-mono text-sm text-[#8b5cf6]" aria-hidden="true">
              {open ? "-" : "+"}
            </span>
            <span className="min-w-0">
              <span className="block font-cinzel text-sm text-[#e8dfc8]">{label}</span>
              <span className="mt-0.5 block font-mono text-xs text-[#8b5cf6]">{path}</span>
            </span>
          </span>
        </button>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {notInNav && (
            <span className="rounded-full border border-[#3a2a45] px-2 py-1 font-cinzel text-[10px] uppercase tracking-widest text-[#6a5a78]">
              Not in nav
            </span>
          )}
          {generated && (
            <span className="rounded-full border border-[#3a2a45] px-2 py-1 font-cinzel text-[10px] uppercase tracking-widest text-[#9080a0]">
              Generated
            </span>
          )}
          <span className="rounded-full border border-[#f59e0b] px-2 py-1 font-cinzel text-[10px] uppercase tracking-widest text-[#f59e0b]">
            Locked
          </span>
        </div>
      </div>

      {open && <div className="border-t border-[#2a2a35] p-5 pt-4">{children}</div>}
    </article>
  );
}
