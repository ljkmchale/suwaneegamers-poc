"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  type LucideIcon,
  Search,
  X,
  MapPin,
  Shield,
  Swords,
  ScrollText,
  Crown,
  User,
  BookOpen,
  Skull,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import type { SearchResult, SearchResultType } from "@/lib/search";

const TYPE_ICONS: Record<SearchResultType, LucideIcon> = {
  territory: MapPin,
  organization: Shield,
  campaign: Swords,
  session: ScrollText,
  dm: Crown,
  player: User,
  gazetteer: BookOpen,
  creature: Skull,
  deity: Sparkles,
  page: LayoutDashboard,
};

const CATEGORY_COLOR: Record<string, string> = {
  Territories: "var(--color-accent-ice)",
  Organizations: "var(--color-accent-blood)",
  Campaigns: "var(--color-accent-gold)",
  "Session Logs": "var(--color-text-secondary)",
  "Dungeon Masters": "var(--color-accent-arcane)",
  Players: "var(--color-text-muted)",
  Gazetteer: "var(--color-accent-gold)",
  Bestiary: "var(--color-accent-blood)",
  Pantheon: "var(--color-accent-arcane)",
  Pages: "var(--color-text-muted)",
};

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function SearchPalette({ open, onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.length < 2) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data: SearchResult[] = await res.json();
        setResults(data);
        setActiveIndex(-1);
      } catch {
        /* ignore fetch errors and aborted stale requests */
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const navigate = useCallback(
    (result: SearchResult) => {
      onClose();
      if (result.external) {
        window.open(result.href, "_blank", "noopener,noreferrer");
      } else {
        router.push(result.href);
      }
    },
    [onClose, router],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
        navigate(results[activeIndex]);
      }
    },
    [results, activeIndex, navigate, onClose],
  );

  if (!mounted || !open) return null;

  // Group by category, preserving insertion order
  const grouped = new Map<string, SearchResult[]>();
  for (const r of results) {
    const bucket = grouped.get(r.category) ?? [];
    bucket.push(r);
    grouped.set(r.category, bucket);
  }

  const isEmpty = query.length >= 2 && results.length === 0;

  return createPortal(
    <div
      className="fixed inset-0 flex items-start justify-center"
      style={{ zIndex: 300, paddingTop: "10vh", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full mx-4 rounded-xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          maxWidth: "42rem",
          maxHeight: "75vh",
          background: "rgba(8,5,18,0.98)",
          borderColor: "var(--color-bg-border)",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Input row */}
        <div
          className="flex items-center gap-3 px-4 shrink-0 border-b"
          style={{ borderColor: "var(--color-bg-border)" }}
        >
          <Search size={15} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search territories, monsters, gods, sessions…"
            className="flex-1 py-4 bg-transparent outline-none text-sm tracking-wide"
            style={{ color: "var(--color-text-primary)" }}
            aria-label="Search"
          />
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded transition-opacity opacity-60 hover:opacity-100"
            style={{ color: "var(--color-text-muted)" }}
            aria-label="Close search"
          >
            <X size={15} />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1">
          {isEmpty ? (
            <div
              className="px-4 py-10 text-center text-xs font-cinzel tracking-widest"
              style={{ color: "var(--color-text-muted)" }}
            >
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : grouped.size > 0 ? (
            Array.from(grouped.entries()).map(([category, items]) => {
              const color = CATEGORY_COLOR[category] ?? "var(--color-text-secondary)";
              return (
                <div key={category}>
                  <div
                    className="px-4 py-1.5 text-xs font-cinzel tracking-widest uppercase"
                    style={{
                      color,
                      background: "rgba(255,255,255,0.025)",
                      borderBottom: "1px solid var(--color-bg-border)",
                    }}
                  >
                    {category}
                  </div>
                  {items.map((result) => {
                    const flatIdx = results.indexOf(result);
                    const isActive = flatIdx === activeIndex;
                    const Icon = TYPE_ICONS[result.type];
                    return (
                      <button
                        key={result.id}
                        data-active={isActive ? "true" : undefined}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                        style={{
                          background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                          borderLeft: isActive ? `2px solid ${color}` : "2px solid transparent",
                        }}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                        onClick={() => navigate(result)}
                      >
                        <Icon
                          size={13}
                          style={{ color, flexShrink: 0, opacity: 0.85 }}
                          aria-hidden
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm font-cinzel tracking-wide truncate"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            {result.title}
                          </div>
                          {result.subtitle && (
                            <div
                              className="text-xs truncate mt-0.5"
                              style={{ color: "var(--color-text-muted)" }}
                            >
                              {result.subtitle}
                            </div>
                          )}
                        </div>
                        {result.external && (
                          <span
                            className="text-xs shrink-0"
                            style={{ color: "var(--color-text-muted)" }}
                            aria-label="Opens in new tab"
                          >
                            ↗
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          ) : (
            <div
              className="px-4 py-10 text-center text-xs font-cinzel tracking-widest"
              style={{ color: "var(--color-text-muted)" }}
            >
              Search territories, monsters, gods, sessions, and more
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div
          className="shrink-0 px-4 py-2 flex gap-4 text-xs border-t"
          style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-muted)" }}
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
