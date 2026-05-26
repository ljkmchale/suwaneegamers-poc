import { notFound } from "next/navigation";
import { getPlayerProfileSeeds } from "@/lib/players";
import { PlayerForm } from "../PlayerForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPlayerPage({ params }: Props) {
  const { id } = await params;
  const player = getPlayerProfileSeeds().find((p) => p.id === id);
  if (!player) notFound();

  return (
    <div>
      <h1 className="font-cinzel text-2xl tracking-widest uppercase mb-2">Edit Player</h1>
      <p className="text-sm text-[#a89880] mb-8">{player.name}</p>
      <PlayerForm player={player} />
    </div>
  );
}
