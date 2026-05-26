"use client";

import Link from "next/link";
import type { PortalCampaign } from "@/lib/campaigns";
import { saveCampaignAction, deleteCampaignAction } from "./actions";
import { ImagePickerField } from "../components/ImagePickerField";

function partyToText(party: PortalCampaign["party"]) {
  return (party ?? []).map((m) => [m.name, m.player, m.url].filter(Boolean).join(" | ")).join("\n");
}

function resourcesToText(resources: PortalCampaign["resources"]) {
  return (resources ?? []).map((r) => `${r.label} | ${r.url}`).join("\n");
}

function summariesToText(summaries: PortalCampaign["sessionSummaries"]) {
  return (summaries ?? []).map((s) => `${s.title}\n${s.summary}`).join("\n---\n");
}

interface Props {
  campaign?: PortalCampaign;
  isNew?: boolean;
}

const INPUT = "w-full px-3 py-2 rounded border border-[#2a2a35] bg-[#16161e] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] text-sm";
const LABEL = "block mb-1 text-xs font-cinzel tracking-widest uppercase text-[#a89880]";
const HINT = "text-xs text-[#5a5060] mt-1";

export function CampaignForm({ campaign, isNew }: Props) {
  return (
    <form action={saveCampaignAction} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className={LABEL}>ID (URL slug)</label>
          <input name="id" defaultValue={campaign?.id ?? ""} required readOnly={!isNew}
            className={`${INPUT} ${!isNew ? "opacity-50 cursor-not-allowed" : ""}`}
            placeholder="my-campaign" />
          {isNew && <p className={HINT}>Lowercase letters, numbers, and hyphens only. Cannot be changed later.</p>}
        </div>
        <div>
          <label className={LABEL}>Name</label>
          <input name="name" defaultValue={campaign?.name ?? ""} required className={INPUT} placeholder="Campaign Title" />
        </div>
        <div>
          <label className={LABEL}>Dungeon Master</label>
          <input name="dm" defaultValue={campaign?.dm ?? ""} required className={INPUT} placeholder="DM Name" />
        </div>
        <div>
          <label className={LABEL}>Schedule</label>
          <input name="schedule" defaultValue={campaign?.schedule ?? ""} required className={INPUT} placeholder="1st & 3rd Thursday" />
        </div>
      </div>

      <div>
        <label className={LABEL}>Description</label>
        <textarea name="description" defaultValue={campaign?.description ?? ""} rows={3} className={`${INPUT} resize-y`} placeholder="Campaign overview…" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className={LABEL}>Reference URL (legacy Google Site)</label>
          <input name="referenceUrl" defaultValue={campaign?.referenceUrl ?? ""} className={INPUT} placeholder="https://sites.google.com/..." />
        </div>
        <div>
          <label className={LABEL}>Header Image Position (CSS)</label>
          <input name="headerImagePosition" defaultValue={campaign?.headerImagePosition ?? ""} className={INPUT} placeholder="center top" />
        </div>
        <div>
          <label className={LABEL}>Type</label>
          <select name="official" defaultValue={campaign?.official === false ? "false" : "true"}
            className={INPUT}>
            <option value="true">Official Campaign</option>
            <option value="false">Side / Other</option>
          </select>
        </div>
      </div>

      <ImagePickerField name="headerImage" label="Header Image" subfolder="campaigns" defaultValue={campaign?.headerImage ?? ""} />

      <div>
        <label className={LABEL}>Aliases (comma-separated, for calendar matching)</label>
        <input name="aliases" defaultValue={(campaign?.aliases ?? []).join(", ")} className={INPUT} placeholder="emberstran, alternate name" />
      </div>

      <div>
        <label className={LABEL}>Party Members</label>
        <textarea name="party" defaultValue={partyToText(campaign?.party)} rows={6} className={`${INPUT} resize-y font-mono text-xs`}
          placeholder={"Character Name | Player Name | https://character-sheet-url\nAnother Character | Player"} />
        <p className={HINT}>One member per line: Name | Player | URL (player and URL are optional)</p>
      </div>

      <div>
        <label className={LABEL}>Resources</label>
        <textarea name="resources" defaultValue={resourcesToText(campaign?.resources)} rows={4} className={`${INPUT} resize-y font-mono text-xs`}
          placeholder={"D&D Beyond | https://www.dndbeyond.com/campaigns/...\nNotes | https://docs.google.com/..."} />
        <p className={HINT}>One per line: Label | URL</p>
      </div>

      <div>
        <label className={LABEL}>Session Summaries</label>
        <textarea name="sessionSummaries" defaultValue={summariesToText(campaign?.sessionSummaries)} rows={8} className={`${INPUT} resize-y font-mono text-xs`}
          placeholder={"Session 1 - Title\nSummary paragraph here.\n---\nSession 2 - Another Title\nAnother summary."} />
        <p className={HINT}>{'Separate sessions with a line containing only "---". First line of each block is the title.'}</p>
      </div>

      <div className="flex items-center gap-4 pt-4 border-t border-[#2a2a35]">
        <button type="submit"
          className="px-6 py-2.5 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors">
          Save Campaign
        </button>
        <Link href="/admin/campaigns" className="text-sm text-[#5a5060] hover:text-[#a89880]">
          Cancel
        </Link>

        {!isNew && campaign && (
          <form action={deleteCampaignAction} className="ml-auto">
            <input type="hidden" name="id" value={campaign.id} />
            <button type="submit"
              onClick={(e) => { if (!confirm(`Delete "${campaign.name}"?`)) e.preventDefault(); }}
              className="px-4 py-2 rounded font-cinzel text-xs tracking-widest uppercase border border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white transition-colors">
              Delete
            </button>
          </form>
        )}
      </div>
    </form>
  );
}
