import Link from "next/link";
import Image from "next/image";
import { getPlayerProfileSeeds } from "@/lib/players";

export default function AdminPlayersPage() {
  const players = getPlayerProfileSeeds();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-cinzel text-3xl tracking-widest uppercase">Players</h1>
          <p className="text-sm text-[#a89880] mt-1">{players.length} players</p>
        </div>
        <Link href="/admin/players/new"
          className="px-4 py-2 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors">
          + New Player
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.map((p) => (
          <Link key={p.id} href={`/admin/players/${p.id}`}
            className="flex items-center gap-4 p-4 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] hover:border-[#8b5cf6] transition-colors">
            {p.portrait ? (
              <Image src={p.portrait} alt={p.name} width={40} height={40}
                className="rounded-full object-cover w-10 h-10" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#2a2a35] flex items-center justify-center text-[#5a5060] text-lg font-cinzel">
                {p.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{p.name}</p>
              <p className="text-xs text-[#5a5060] truncate">{p.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
