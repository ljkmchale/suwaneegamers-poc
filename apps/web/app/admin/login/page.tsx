import type { Metadata } from "next";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Admin Login" };

interface Props {
  searchParams: Promise<{ error?: string; from?: string; editMode?: string }>;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { error, from, editMode } = await searchParams;
  const wantsEditMode = editMode === "1";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08050f]">
      <div className="w-full max-w-sm px-8 py-10 rounded-lg border border-[#2a2a35] bg-[#0f0a1a]">
        <h1 className="font-cinzel text-2xl tracking-widest uppercase text-center mb-1 text-[#e8dfc8]">
          Admin
        </h1>
        <p className="text-xs text-center tracking-widest uppercase mb-8 text-[#5a5060]">
          {wantsEditMode ? "Enable Page Editing" : "Suwanee Gamers Portal"}
        </p>

        {error && (
          <p className="text-sm text-center mb-4 text-red-400">
            Incorrect admin password.
          </p>
        )}

        <form action={loginAction}>
          <input type="hidden" name="from" value={from ?? (wantsEditMode ? "/" : "/admin")} />
          {wantsEditMode && <input type="hidden" name="editMode" value="1" />}
          <label className="block mb-1 text-xs font-cinzel tracking-widest uppercase text-[#a89880]">
            Admin Password
          </label>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="w-full px-3 py-2 rounded border border-[#2a2a35] bg-[#16161e] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] mb-6"
            placeholder="Enter admin password"
          />
          <button
            type="submit"
            className="w-full py-2.5 rounded font-cinzel tracking-widest uppercase text-sm font-semibold text-[#e8dfc8] bg-[#8b5cf6] hover:bg-[#7c3aed] transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
