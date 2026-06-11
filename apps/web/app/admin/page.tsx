import Link from "next/link";

const SECTIONS = [
  { href: "/admin/pages", title: "Pages", desc: "Create custom pages and build them with blocks." },
  { href: "/admin/source-managed", title: "Source Managed", desc: "Lock pages and link Google Docs as authoritative sources." },
  { href: "/admin/page-layout", title: "Navigation Layout", desc: "Add, remove, rename, and reorder navigation menus and links." },
  { href: "/admin/appearance", title: "Appearance", desc: "Change colors, fonts, and site name." },
  { href: "/admin/media", title: "Media", desc: "Upload images and browse the media library." },
];

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="font-cinzel text-3xl tracking-widest uppercase mb-2">Dashboard</h1>
      <p className="text-sm text-[#a89880] mb-10">What would you like to update?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block p-6 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] hover:border-[#8b5cf6] transition-colors group"
          >
            <h2 className="font-cinzel text-lg tracking-widest uppercase mb-2 group-hover:text-[#f59e0b] transition-colors">
              {s.title}
            </h2>
            <p className="text-sm text-[#a89880]">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
