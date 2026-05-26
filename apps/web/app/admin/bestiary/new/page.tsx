import { CreatureForm } from "../CreatureForm";

export default function NewCreaturePage() {
  return (
    <div>
      <h1 className="font-cinzel text-2xl tracking-widest uppercase mb-2">New Creature</h1>
      <p className="text-sm text-[#a89880] mb-8">Add a creature to the bestiary.</p>
      <CreatureForm isNew />
    </div>
  );
}
