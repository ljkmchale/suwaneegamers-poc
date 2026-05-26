"use client";

import Link from "next/link";
import type { DungeonMasterProfile } from "@/lib/dungeonMasters";
import { saveDmAction, deleteDmAction } from "./actions";
import { ImagePickerField } from "../components/ImagePickerField";

const INPUT = "w-full px-3 py-2 rounded border border-[#2a2a35] bg-[#16161e] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] text-sm";
const LABEL = "block mb-1 text-xs font-cinzel tracking-widest uppercase text-[#a89880]";
const HINT = "text-xs text-[#5a5060] mt-1";

function prevToText(prev: DungeonMasterProfile["previousCampaigns"]) {
  return prev.map((c) => `${c.name} | ${c.status}`).join("\n");
}

interface Props {
  dm?: DungeonMasterProfile;
  isNew?: boolean;
}

export function DmForm({ dm, isNew }: Props) {
  return (
    <form action={saveDmAction} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className={LABEL}>ID (slug)</label>
          <input name="id" defaultValue={dm?.id ?? ""} required readOnly={!isNew}
            className={`${INPUT} ${!isNew ? "opacity-50 cursor-not-allowed" : ""}`}
            placeholder="first-last" />
        </div>
        <div>
          <label className={LABEL}>Name</label>
          <input name="name" defaultValue={dm?.name ?? ""} required className={INPUT} />
        </div>
      </div>

      <div>
        <label className={LABEL}>Focus</label>
        <input name="focus" defaultValue={dm?.focus ?? ""} className={INPUT} placeholder="Long-form campaigns and…" />
      </div>

      <div>
        <label className={LABEL}>Description</label>
        <textarea name="description" defaultValue={dm?.description ?? ""} rows={3} className={`${INPUT} resize-y`} />
      </div>

      <ImagePickerField name="portrait" label="Portrait Image" subfolder="dungeon-masters" defaultValue={dm?.portrait ?? ""} />

      <div>
        <label className={LABEL}>Active Campaign IDs (comma-separated)</label>
        <input name="activeCampaignIds" defaultValue={(dm?.activeCampaignIds ?? []).join(", ")} className={INPUT}
          placeholder="a-new-adventure, heroes-of-emberstran" />
        <p className={HINT}>Use the campaign ID slugs exactly as they appear in the Campaigns list.</p>
      </div>

      <div>
        <label className={LABEL}>Previous Campaigns</label>
        <textarea name="previousCampaigns" defaultValue={prevToText(dm?.previousCampaigns ?? [])} rows={4}
          className={`${INPUT} resize-y font-mono text-xs`}
          placeholder={"Beer & Dice | Completed\nImminent Domain | On Hiatus"} />
        <p className={HINT}>One per line: Campaign Name | Completed or On Hiatus</p>
      </div>

      <div className="flex items-center gap-4 pt-4 border-t border-[#2a2a35]">
        <button type="submit"
          className="px-6 py-2.5 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors">
          Save
        </button>
        <Link href="/admin/dungeon-masters" className="text-sm text-[#5a5060] hover:text-[#a89880]">Cancel</Link>

        {!isNew && dm && (
          <form action={deleteDmAction} className="ml-auto">
            <input type="hidden" name="id" value={dm.id} />
            <button type="submit"
              onClick={(e) => { if (!confirm(`Delete "${dm.name}"?`)) e.preventDefault(); }}
              className="px-4 py-2 rounded font-cinzel text-xs tracking-widest uppercase border border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white transition-colors">
              Delete
            </button>
          </form>
        )}
      </div>
    </form>
  );
}
