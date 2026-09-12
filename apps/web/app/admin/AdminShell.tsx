"use client";

import Link from "next/link";
import { ChevronDown, Home } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { logoutAction } from "./login/actions";

const PRIMARY_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/store", label: "Store" },
];
const NAV_GROUPS = [
  { label: "Site Insights", links: [
    { href: "/admin/analytics/audience", label: "Audience & Acquisition" },
    { href: "/admin/analytics/content", label: "Content & Journeys" },
    { href: "/admin/analytics/maps", label: "Maps of Myrdae" },
    { href: "/admin/analytics/live", label: "Live Activity" },
  ] },
  { label: "Myra", links: [
    { href: "/admin/voice-assistant", label: "Usage & Cost" },
    { href: "/admin/voice-assistant?section=quality", label: "Questions & Quality" },
    { href: "/admin/voice-assistant?section=settings", label: "Tuning & Voices" },
    { href: "/admin/myra-health", label: "Health" },
    { href: "/admin/feedback", label: "User Feedback" },
    { href: "/admin/pronunciations", label: "Pronunciations" },
  ] },
  { label: "Operations", links: [
    { href: "/admin/analytics/operations", label: "Performance & Jobs" },
    { href: "/admin/source-managed", label: "Source Managed" },
  ] },
  { label: "Security", links: [{ href: "/admin/security", label: "Threats & Sign-ins" }] },
  { label: "Content & Design", links: [
    { href: "/admin/pages", label: "Pages" },
    { href: "/admin/page-layout", label: "Navigation Layout" },
    { href: "/admin/appearance", label: "Appearance" },
    { href: "/admin/media", label: "Media" },
    { href: "/admin/map-editor", label: "Map Editor" },
    { href: "/admin/advents-guide", label: "Advents Guide Reviews" },
  ] },
];

function AdminNavGroup({
  label,
  links,
  adminPath,
}: {
  label: string;
  links: { href: string; label: string }[];
  adminPath: string;
}) {
  const activeGroup = links.some((link) => link.href === adminPath);
  return (
    <details className="group" open={activeGroup || undefined}>
      <summary
        className={`flex cursor-pointer list-none items-center justify-between px-6 py-2.5 text-sm transition-colors hover:bg-[#16161e] hover:text-[#f59e0b] [&::-webkit-details-marker]:hidden ${activeGroup ? "bg-[#16161e] text-[#f59e0b]" : ""}`}
      >
        <span>{label}</span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className="transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-y border-[#21182e] bg-[#0b0713] py-1">
        {links.map((link) => {
          const active = adminPath === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`block border-l-2 py-2 pl-8 pr-4 text-sm transition-colors hover:bg-[#16161e] hover:text-[#f59e0b] ${active ? "border-[#8b5cf6] bg-[#16161e] text-[#e8dfc8]" : "border-transparent text-[#a89880]"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </details>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const params = useSearchParams();
  const section = params.get("section");
  const isLoginPage = path === "/admin/login";
  const adminPath = path === "/admin/analytics" ? "/admin" : path + (path === "/admin/voice-assistant" && ["quality", "settings"].includes(section ?? "") ? `?section=${section}` : "");
  const isMapEditor = adminPath === "/admin/map-editor";

  if (isLoginPage) return children;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#08050f] font-sans text-[#e8dfc8]">
      {/* Sidebar */}
      <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-[#2a2a35] bg-[#0f0a1a] flex flex-col">
        <div className="px-6 py-5 border-b border-[#2a2a35]">
          <p className="font-cinzel text-sm tracking-widest uppercase text-[#8b5cf6]">
            Admin
          </p>
          <p className="text-xs text-[#5a5060] mt-0.5">Suwanee Gamers</p>
        </div>

        <div className="px-4 py-4 border-b border-[#2a2a35]">
          <Link
            href="/"
            className="flex items-center gap-2 rounded px-2 py-2 text-sm text-[#a89880] hover:bg-[#16161e] hover:text-[#f59e0b] transition-colors"
          >
            <Home size={16} strokeWidth={2} aria-hidden="true" />
            Main Site
          </Link>
        </div>

        <nav aria-label="Admin sections" className="flex-1 py-4">
          {PRIMARY_LINKS.map((link) => <Link key={link.href} href={link.href} aria-current={adminPath === link.href ? "page" : undefined}
            className={`block border-l-2 px-6 py-2.5 text-sm transition-colors hover:bg-[#16161e] hover:text-[#f59e0b] ${adminPath === link.href ? "border-violet-500 bg-[#16161e] text-[#e8dfc8]" : "border-transparent text-[#c8bda8]"}`}>{link.label}</Link>)}
          {NAV_GROUPS.map((group) => <AdminNavGroup key={group.label} label={group.label} links={group.links} adminPath={adminPath} />)}
        </nav>

        <div className="px-4 py-4 border-t border-[#2a2a35]">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left px-2 py-2 text-xs text-[#5a5060] hover:text-[#ef4444] transition-colors"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className={isMapEditor ? "min-w-0 flex-1 overflow-hidden" : "min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8"}>
        {children}
      </main>
    </div>
  );
}
