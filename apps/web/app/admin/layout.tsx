import Link from "next/link";
import { logoutAction } from "./login/actions";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/dungeon-masters", label: "Dungeon Masters" },
  { href: "/admin/bestiary", label: "Bestiary" },
  { href: "/admin/page-layout", label: "Page Layout" },
  { href: "/admin/appearance", label: "Appearance" },
  { href: "/admin/media", label: "Media" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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

        <nav className="flex-1 py-4">
          {NAV_LINKS.map((link) => (
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
      <main className="flex-1 overflow-auto p-8 max-w-5xl">
        {children}
      </main>
    </div>
  );
}
