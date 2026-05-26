import Link from "next/link";
import { getDungeonMasters } from "@/lib/dungeonMasters";

export default function AdminDungeonMastersPage() {
  const dms = getDungeonMasters();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-cinzel text-3xl tracking-widest uppercase">Dungeon Masters</h1>
          <p className="text-sm text-[#a89880] mt-1">{dms.length} DMs</p>
        </div>
        <Link href="/admin/dungeon-masters/new"
          className="px-4 py-2 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors">
          + New DM
        </Link>
      </div>

      <div className="space-y-2">
        {dms.map((dm) => (
          <Link key={dm.id} href={`/admin/dungeon-masters/${dm.id}`}
            className="flex items-center justify-between px-5 py-4 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] hover:border-[#8b5cf6] transition-colors">
            <div>
              <p className="font-medium">{dm.name}</p>
              <p className="text-xs text-[#5a5060]">{dm.focus}</p>
            </div>
            <span className="text-xs text-[#a89880]">
              {dm.activeCampaignIds.length} active campaign{dm.activeCampaignIds.length !== 1 ? "s" : ""}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
