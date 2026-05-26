import { DmForm } from "../DmForm";

export default function NewDmPage() {
  return (
    <div>
      <h1 className="font-cinzel text-2xl tracking-widest uppercase mb-2">New Dungeon Master</h1>
      <p className="text-sm text-[#a89880] mb-8">Fill in the details and click Save.</p>
      <DmForm isNew />
    </div>
  );
}
