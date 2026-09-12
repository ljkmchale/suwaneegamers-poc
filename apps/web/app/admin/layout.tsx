import { Suspense } from "react";
import AdminShell from "./AdminShell";
export const dynamic = "force-dynamic";
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen bg-[#08050f] p-8 text-[#e8dfc8]">Loading admin…</div>}><AdminShell>{children}</AdminShell></Suspense>;
}
