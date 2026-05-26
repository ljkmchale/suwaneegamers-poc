"use client";

import Link from "next/link";
import type { PlayerProfileSeed } from "@/lib/players";
import { savePlayerAction, deletePlayerAction } from "./actions";
import { ImagePickerField } from "../components/ImagePickerField";

const INPUT = "w-full px-3 py-2 rounded border border-[#2a2a35] bg-[#16161e] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] text-sm";
const LABEL = "block mb-1 text-xs font-cinzel tracking-widest uppercase text-[#a89880]";

interface Props {
  player?: PlayerProfileSeed;
  isNew?: boolean;
}

export function PlayerForm({ player, isNew }: Props) {
  return (
    <form action={savePlayerAction} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className={LABEL}>ID (slug)</label>
          <input name="id" defaultValue={player?.id ?? ""} required readOnly={!isNew}
            className={`${INPUT} ${!isNew ? "opacity-50 cursor-not-allowed" : ""}`}
            placeholder="first-last" />
        </div>
        <div>
          <label className={LABEL}>Name</label>
          <input name="name" defaultValue={player?.name ?? ""} required className={INPUT} placeholder="Full Name" />
        </div>
      </div>

      <div>
        <label className={LABEL}>Description</label>
        <textarea name="description" defaultValue={player?.description ?? ""} rows={3} className={`${INPUT} resize-y`}
          placeholder="Suwanee Gamers player with…" />
      </div>

      <ImagePickerField name="portrait" label="Portrait Image" subfolder="players" defaultValue={player?.portrait ?? ""} />

      <div className="flex items-center gap-4 pt-4 border-t border-[#2a2a35]">
        <button type="submit"
          className="px-6 py-2.5 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors">
          Save Player
        </button>
        <Link href="/admin/players" className="text-sm text-[#5a5060] hover:text-[#a89880]">Cancel</Link>

        {!isNew && player && (
          <form action={deletePlayerAction} className="ml-auto">
            <input type="hidden" name="id" value={player.id} />
            <button type="submit"
              onClick={(e) => { if (!confirm(`Delete "${player.name}"?`)) e.preventDefault(); }}
              className="px-4 py-2 rounded font-cinzel text-xs tracking-widest uppercase border border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white transition-colors">
              Delete
            </button>
          </form>
        )}
      </div>
    </form>
  );
}
