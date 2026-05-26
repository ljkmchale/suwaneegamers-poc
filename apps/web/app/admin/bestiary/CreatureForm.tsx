"use client";

import Link from "next/link";
import { saveCreatureAction, deleteCreatureAction } from "./actions";
import { ImagePickerField } from "../components/ImagePickerField";

const INPUT = "w-full px-3 py-2 rounded border border-[#2a2a35] bg-[#16161e] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] text-sm";
const LABEL = "block mb-1 text-xs font-cinzel tracking-widest uppercase text-[#a89880]";

interface Creature { name: string; type: string; image: string; href?: string; }

interface Props {
  creature?: Creature;
  isNew?: boolean;
}

export function CreatureForm({ creature, isNew }: Props) {
  return (
    <form action={saveCreatureAction} className="space-y-6">
      <input type="hidden" name="originalName" value={creature?.name ?? ""} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className={LABEL}>Name</label>
          <input name="name" defaultValue={creature?.name ?? ""} required className={INPUT} placeholder="Bulas" />
        </div>
        <div>
          <label className={LABEL}>Type</label>
          <input name="type" defaultValue={creature?.type ?? ""} required className={INPUT} placeholder="Beast" />
        </div>
      </div>

      <ImagePickerField name="image" label="Creature Image" subfolder="bestiary" defaultValue={creature?.image ?? ""} />

      <div>
        <label className={LABEL}>D&D Beyond Stat Block URL (optional)</label>
        <input name="href" defaultValue={creature?.href ?? ""} className={INPUT} placeholder="https://www.dndbeyond.com/monsters/..." />
      </div>

      <div className="flex items-center gap-4 pt-4 border-t border-[#2a2a35]">
        <button type="submit"
          className="px-6 py-2.5 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors">
          Save Creature
        </button>
        <Link href="/admin/bestiary" className="text-sm text-[#5a5060] hover:text-[#a89880]">Cancel</Link>

        {!isNew && creature && (
          <form action={deleteCreatureAction} className="ml-auto">
            <input type="hidden" name="name" value={creature.name} />
            <button type="submit"
              onClick={(e) => { if (!confirm(`Delete "${creature.name}"?`)) e.preventDefault(); }}
              className="px-4 py-2 rounded font-cinzel text-xs tracking-widest uppercase border border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white transition-colors">
              Delete
            </button>
          </form>
        )}
      </div>
    </form>
  );
}
