import { notFound } from "next/navigation";
import { getDungeonMasters } from "@/lib/dungeonMasters";
import { DmForm } from "../DmForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditDmPage({ params }: Props) {
  const { id } = await params;
  const dm = getDungeonMasters().find((d) => d.id === id);
  if (!dm) notFound();

  return (
    <div>
      <h1 className="font-cinzel text-2xl tracking-widest uppercase mb-2">Edit Dungeon Master</h1>
      <p className="text-sm text-[#a89880] mb-8">{dm.name}</p>
      <DmForm dm={dm} />
    </div>
  );
}
