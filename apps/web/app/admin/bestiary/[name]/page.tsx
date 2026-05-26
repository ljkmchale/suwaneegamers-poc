import { notFound } from "next/navigation";
import { readContent } from "@/lib/contentFiles";
import { CreatureForm } from "../CreatureForm";

interface Creature { name: string; type: string; image: string; href?: string; }

interface Props {
  params: Promise<{ name: string }>;
}

export default async function EditCreaturePage({ params }: Props) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const creatures = readContent<Creature[]>("bestiary.json");
  const creature = creatures.find((c) => c.name === decodedName);
  if (!creature) notFound();

  return (
    <div>
      <h1 className="font-cinzel text-2xl tracking-widest uppercase mb-2">Edit Creature</h1>
      <p className="text-sm text-[#a89880] mb-8">{creature.name}</p>
      <CreatureForm creature={creature} />
    </div>
  );
}
