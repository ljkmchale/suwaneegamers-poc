import { PlayerForm } from "../PlayerForm";

export default function NewPlayerPage() {
  return (
    <div>
      <h1 className="font-cinzel text-2xl tracking-widest uppercase mb-2">New Player</h1>
      <p className="text-sm text-[#a89880] mb-8">Fill in the details and click Save.</p>
      <PlayerForm isNew />
    </div>
  );
}
