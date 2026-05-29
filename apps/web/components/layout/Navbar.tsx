"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PencilLine, Shield } from "lucide-react";
import { disableEditModeAction, enableEditModeAction } from "@/app/admin/login/actions";
import type { NavSection } from "@/lib/nav";

interface NavProps {
  sections: NavSection[];
  isAdmin?: boolean;
  editMode?: boolean;
}

export function Navbar({ sections, isAdmin = false, editMode = false }: NavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const isExternal = (href: string) => href.startsWith("http://") || href.startsWith("https://");
  const isActive = (href: string) =>
    !isExternal(href) && (pathname === href || pathname.startsWith(href + "/"));

  // Convention: "primary" = flat links left, "tools" = flat links right, everything else = dropdown
  const primaryNav = sections.find((s) => s.id === "primary")?.items ?? [];
  const toolsNav = sections.find((s) => s.id === "tools")?.items ?? [];
  const dropdownSections = sections.filter((s) => s.id !== "primary" && s.id !== "tools");

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
          {primaryNav.map((link) => {
            const className = "px-3 py-2 rounded text-xs font-cinzel tracking-wider uppercase transition-colors";
            const style = {
              color: isActive(link.href)
                ? "var(--color-accent-gold)"
                : "var(--color-text-secondary)",
            };

            return isExternal(link.href) ? (
              <a key={link.id} href={link.href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
                {link.label}
              </a>
            ) : (
              <Link key={link.id} href={link.href} className={className} style={style}>
                {link.label}
              </Link>
            );
          })}

          {/* Dropdown sections (everything except primary and tools) */}
          {dropdownSections.map((section) => (
            <div
              key={section.id}
              className="relative"
              onMouseEnter={() => setOpenDropdown(section.id)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                className="px-3 py-2 rounded text-xs font-cinzel tracking-wider uppercase transition-colors flex items-center gap-1"
                style={{
                  color: section.items.some((l) => isActive(l.href))
                    ? "var(--color-accent-gold)"
                    : "var(--color-text-secondary)",
                }}
              >
                {section.label}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {openDropdown === section.id && section.items.length > 0 && (
                <div className="absolute top-full left-0 pt-1 min-w-48 z-50">
                  <div
                    className="rounded-lg border py-1 shadow-2xl"
                    style={{
                      background: "rgba(10, 7, 20, 0.97)",
                      borderColor: "var(--color-bg-border)",
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    {section.items.map((link) => {
                      const cls = "block px-4 py-2 text-xs font-cinzel tracking-wider uppercase transition-colors";
                      const style = { color: isActive(link.href) ? "var(--color-accent-gold)" : "var(--color-text-secondary)" };
                      return isExternal(link.href) ? (
                        <a key={link.id} href={link.href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
                          {link.label}
                        </a>
                      ) : (
                        <Link key={link.id} href={link.href} className={cls} style={style}>
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Tools — flat links on the right */}
          {toolsNav.map((link) => {
            const className = "px-3 py-2 rounded text-xs font-cinzel tracking-wider uppercase transition-colors";
            const style = { color: isActive(link.href) ? "var(--color-accent-arcane)" : "var(--color-text-secondary)" };
            return isExternal(link.href) ? (
              <a key={link.id} href={link.href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
                {link.label}
              </a>
            ) : (
              <Link key={link.id} href={link.href} className={className} style={style}>
                {link.label}
              </Link>
            );
          })}

          <form action={editMode ? disableEditModeAction : enableEditModeAction} className="ml-auto">
            <input type="hidden" name="from" value={pathname} />
            <button
              type="submit"
              aria-label={editMode ? "Disable edit mode" : "Enable edit mode"}
              title={editMode ? "Disable edit mode" : "Enable edit mode"}
              className="inline-flex h-9 w-9 items-center justify-center rounded border transition-colors"
              style={{
                borderColor: editMode ? "var(--color-accent-gold)" : "var(--color-bg-border)",
                color: editMode ? "var(--color-accent-gold)" : "var(--color-text-secondary)",
              }}
            >
              <PencilLine size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          </form>

          <Link
            href={isAdmin ? "/admin" : "/admin/login"}
            aria-label={isAdmin ? "Admin dashboard" : "Admin login"}
            title={isAdmin ? "Admin dashboard" : "Admin login"}
            className="inline-flex h-9 w-9 items-center justify-center rounded border transition-colors"
            style={{
              borderColor: isAdmin || isActive("/admin") ? "var(--color-accent-gold)" : "var(--color-bg-border)",
              color: isAdmin || isActive("/admin") ? "var(--color-accent-gold)" : "var(--color-text-secondary)",
            }}
          >
            <Shield size={17} strokeWidth={2} aria-hidden="true" />
          </Link>
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
            {sections.flatMap((s) => s.items).map((link) => {
              const className = "block px-3 py-2.5 rounded font-cinzel text-xs tracking-wider uppercase";
              const style = {
                color: isActive(link.href)
                  ? "var(--color-accent-gold)"
                  : "var(--color-text-secondary)",
              };

              return isExternal(link.href) ? (
                <a
                  key={link.id}
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
                  key={link.id}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={className}
                  style={style}
                >
                  {link.label}
                </Link>
              );
            })}
            <form action={editMode ? disableEditModeAction : enableEditModeAction}>
              <input type="hidden" name="from" value={pathname} />
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2.5 rounded font-cinzel text-xs tracking-wider uppercase"
                style={{
                  color: editMode
                    ? "var(--color-accent-gold)"
                    : "var(--color-text-secondary)",
                }}
              >
                <PencilLine size={16} strokeWidth={2} aria-hidden="true" />
                {editMode ? "Disable Edit Mode" : "Enable Edit Mode"}
              </button>
            </form>
            <Link
              href={isAdmin ? "/admin" : "/admin/login"}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded font-cinzel text-xs tracking-wider uppercase"
              style={{
                color: isActive("/admin")
                  ? "var(--color-accent-gold)"
                  : "var(--color-text-secondary)",
              }}
            >
              <Shield size={16} strokeWidth={2} aria-hidden="true" />
              Admin
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
