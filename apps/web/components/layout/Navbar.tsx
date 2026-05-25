"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const PRIMARY_NAV = [
  { href: "/calendar", label: "Calendar" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/dungeon-masters", label: "DMs" },
];

const WORLD_NAV = [
  { href: "https://mapeditor.suwaneegamers.net/embed-map.html", label: "Map Viewer" },
  { href: "/bestiary", label: "Bestiary" },
  { href: "/setting", label: "Setting" },
  { href: "/territories", label: "Territories" },
  { href: "/pantheon", label: "Pantheon" },
  { href: "/history", label: "History" },
  { href: "/lore", label: "Legends & Lore" },
  { href: "/gazetteer", label: "Gazetteer" },
  { href: "/maps-of-myrdae", label: "Maps of Myrdae" },
];

const TOOLS_NAV = [
  { href: "http://kb.suwaneegamers.net", label: "Knowledge Base" },
  { href: "/previous-campaigns", label: "Previous Campaigns" },
];

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [worldOpen, setWorldOpen] = useState(false);

  const isExternal = (href: string) => href.startsWith("http://") || href.startsWith("https://");
  const isActive = (href: string) =>
    !isExternal(href) && (pathname === href || pathname.startsWith(href + "/"));

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b"
      style={{
        background: "rgba(8, 5, 15, 0.88)",
        borderColor: "var(--color-bg-border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="font-cinzel text-base tracking-widest uppercase shrink-0 transition-colors"
          style={{ color: "var(--color-accent-gold)" }}
        >
          ⚔ Suwanee Gamers
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1 flex-1">
          {/* Primary links */}
          {PRIMARY_NAV.map((link) => {
            const className = "px-3 py-2 rounded text-xs font-cinzel tracking-wider uppercase transition-colors";
            const style = {
              color: isActive(link.href)
                ? "var(--color-accent-gold)"
                : "var(--color-text-secondary)",
            };

            return isExternal(link.href) ? (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className={className} style={style}>
                {link.label}
              </Link>
            );
          })}

          {/* World dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setWorldOpen(true)}
            onMouseLeave={() => setWorldOpen(false)}
          >
            <button
              className="px-3 py-2 rounded text-xs font-cinzel tracking-wider uppercase transition-colors flex items-center gap-1"
              style={{
                color: WORLD_NAV.some((l) => isActive(l.href))
                  ? "var(--color-accent-gold)"
                  : "var(--color-text-secondary)",
              }}
            >
              Myrdae
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {worldOpen && (
              <div
                className="absolute top-full left-0 pt-1 min-w-48 z-50"
              >
                <div
                  className="rounded-lg border py-1 shadow-2xl"
                  style={{
                    background: "rgba(10, 7, 20, 0.97)",
                    borderColor: "var(--color-bg-border)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  {WORLD_NAV.map((link) => {
                    const className = "block px-4 py-2 text-xs font-cinzel tracking-wider uppercase transition-colors";
                    const style = {
                      color: isActive(link.href)
                        ? "var(--color-accent-gold)"
                        : "var(--color-text-secondary)",
                    };

                    return isExternal(link.href) ? (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={className}
                        style={style}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link key={link.href} href={link.href} className={className} style={style}>
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Tools */}
          {TOOLS_NAV.map((link) => {
            const className = "px-3 py-2 rounded text-xs font-cinzel tracking-wider uppercase transition-colors";
            const style = {
              color: isActive(link.href)
                ? "var(--color-accent-arcane)"
                : "var(--color-text-secondary)",
            };

            return isExternal(link.href) ? (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className={className} style={style}>
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {menuOpen ? (
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="lg:hidden border-t max-h-screen overflow-y-auto"
          style={{
            background: "rgba(8, 5, 15, 0.97)",
            borderColor: "var(--color-bg-border)",
          }}
        >
          <div className="px-4 py-4 space-y-1">
            {[...PRIMARY_NAV, ...WORLD_NAV, ...TOOLS_NAV].map((link) => {
              const className = "block px-3 py-2.5 rounded font-cinzel text-xs tracking-wider uppercase";
              const style = {
                color: isActive(link.href)
                  ? "var(--color-accent-gold)"
                  : "var(--color-text-secondary)",
              };

              return isExternal(link.href) ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className={className}
                  style={style}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={className}
                  style={style}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
