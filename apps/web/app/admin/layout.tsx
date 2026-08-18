export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronDown, Home } from "lucide-react";
import { headers } from "next/headers";
import { logoutAction } from "./login/actions";

const NAV_LINKS_BEFORE_MYRA = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/store", label: "Store" },
];

const MYRA_LINKS = [
  { href: "/admin/voice-assistant", label: "Overview" },
  { href: "/admin/myra-health", label: "Health" },
  { href: "/admin/feedback", label: "User Feedback" },
  { href: "/admin/pronunciations", label: "Pronunciations" },
];

const SECURITY_LINKS = [
  { href: "/admin/security", label: "Overview" },
  { href: "/admin/analytics", label: "Usage & Connections" },
];

const NAV_LINKS_AFTER_MYRA = [
  { href: "/admin/chronicles", label: "Chronicles" },
  { href: "/admin/map-editor", label: "Map Editor" },
  { href: "/admin/advents-guide", label: "Advents Guide" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/source-managed", label: "Source Managed" },
  { href: "/admin/page-layout", label: "Navigation Layout" },
  { href: "/admin/appearance", label: "Appearance" },
  { href: "/admin/media", label: "Media" },
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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const isLoginPage = requestHeaders.get("x-admin-login-page") === "1";
  const adminPath = requestHeaders.get("x-admin-path") ?? "/admin";
  const isMapEditor = adminPath === "/admin/map-editor";

  if (isLoginPage) return children;

  return (
    <div className="min-h-screen flex bg-[#08050f] text-[#e8dfc8]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-[#2a2a35] bg-[#0f0a1a] flex flex-col">
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

        <nav className="flex-1 py-4">
          {NAV_LINKS_BEFORE_MYRA.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-6 py-2.5 text-sm hover:text-[#f59e0b] hover:bg-[#16161e] transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <AdminNavGroup label="Myra" links={MYRA_LINKS} adminPath={adminPath} />
          <AdminNavGroup label="Security" links={SECURITY_LINKS} adminPath={adminPath} />
          {NAV_LINKS_AFTER_MYRA.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-6 py-2.5 text-sm hover:text-[#f59e0b] hover:bg-[#16161e] transition-colors"
            >
              {link.label}
            </Link>
          ))}
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
      <main className={isMapEditor ? "flex-1 overflow-hidden" : "flex-1 overflow-auto p-8"}>
        {children}
      </main>
    </div>
  );
}
