import Link from "next/link";
import Image from "next/image";
import { readContent } from "@/lib/contentFiles";

interface Creature { name: string; type: string; image: string; href?: string; }

export default function AdminBestiaryPage() {
  const creatures = readContent<Creature[]>("bestiary.json");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-cinzel text-3xl tracking-widest uppercase">Bestiary</h1>
          <p className="text-sm text-[#a89880] mt-1">{creatures.length} creatures</p>
        </div>
        <Link href="/admin/bestiary/new"
          className="px-4 py-2 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors">
          + New Creature
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {creatures.map((c) => (
          <Link key={c.name} href={`/admin/bestiary/${encodeURIComponent(c.name)}`}
            className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] overflow-hidden hover:border-[#8b5cf6] transition-colors">
            <div className="aspect-[4/3] relative bg-[#16161e]">
              <Image src={c.image} alt={c.name} fill className="object-contain p-3" />
            </div>
            <div className="p-3">
              <p className="font-cinzel text-sm truncate">{c.name}</p>
              <p className="text-xs text-[#5a5060]">{c.type}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
