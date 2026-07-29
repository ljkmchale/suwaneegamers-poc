import Link from "next/link";
import { ArrowLeft, SpellCheck2 } from "lucide-react";
import { getAssistantPronunciations } from "@/lib/assistantBrain";
import { PronunciationEditor } from "./PronunciationEditor";

export const dynamic = "force-dynamic";

export default function PronunciationsPage() {
  const pronunciations = getAssistantPronunciations();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/voice-assistant"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-[#9080a0] hover:text-[#e8dfc8] transition-colors"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to Myra
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <SpellCheck2 className="text-violet-300" size={28} aria-hidden="true" />
        <div>
          <h1 className="font-cinzel text-3xl uppercase tracking-widest">Pronunciations</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#a89880]">
            Teach Myra how to say tricky names — campaigns, places, characters — so they sound right
            when she speaks.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-6">
        <PronunciationEditor initial={pronunciations} />
      </section>
    </div>
  );
}
