"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Volume2 } from "lucide-react";
import { savePronunciationsAction } from "./actions";

interface Row {
  id: number;
  word: string;
  pronunciation: string;
}

let nextId = 1;
function makeRow(word = "", pronunciation = ""): Row {
  return { id: nextId++, word, pronunciation };
}

export function PronunciationEditor({ initial }: { initial: Record<string, string> }) {
  const entries = Object.entries(initial);
  const [rows, setRows] = useState<Row[]>(
    entries.length > 0 ? entries.map(([w, p]) => makeRow(w, p)) : [makeRow()],
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function updateRow(id: number, field: "word" | "pronunciation", value: string) {
    setSaved(false);
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setSaved(false);
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(id: number) {
    setSaved(false);
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : [makeRow()]));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await savePronunciationsAction(formData);
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-1">
          <span className="font-cinzel text-[10px] uppercase tracking-widest text-[#6a5a78]">
            Written word
          </span>
          <span className="font-cinzel text-[10px] uppercase tracking-widest text-[#6a5a78]">
            How to say it
          </span>
          <span className="w-9" aria-hidden="true" />
        </div>

        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
            <input
              type="text"
              name="word"
              value={row.word}
              onChange={(e) => updateRow(row.id, "word", e.target.value)}
              placeholder="Emberstran"
              className="rounded border border-[#2a2a35] bg-[#0f0a1a] px-3 py-2 text-sm text-[#e8dfc8] placeholder-[#3a3040] focus:border-[#8b5cf6] focus:outline-none"
            />
            <input
              type="text"
              name="pronunciation"
              value={row.pronunciation}
              onChange={(e) => updateRow(row.id, "pronunciation", e.target.value)}
              placeholder="Em-ber-stran"
              className="rounded border border-[#2a2a35] bg-[#0f0a1a] px-3 py-2 text-sm text-[#e8dfc8] placeholder-[#3a3040] focus:border-[#8b5cf6] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              aria-label={`Remove ${row.word || "row"}`}
              className="flex h-9 w-9 items-center justify-center rounded border border-[#2a2a35] text-[#6a5a78] hover:border-[#ef4444] hover:text-[#ef4444] transition-colors"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded border border-[#2a2a35] px-3 py-2 text-xs text-[#c8bda8] hover:border-[#8b5cf6] hover:text-[#e8dfc8] transition-colors"
        >
          <Plus size={14} aria-hidden="true" /> Add word
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded bg-[#8b5cf6] px-4 py-2 font-cinzel text-[10px] uppercase tracking-widest text-white hover:bg-[#7c3aed] disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : "Save pronunciations"}
        </button>
        {saved && !isPending && (
          <span className="text-xs text-emerald-400">Saved — Myra will use these next session.</span>
        )}
      </div>

      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-[#6a5a78]">
        <Volume2 size={15} className="mt-0.5 shrink-0 text-violet-300" aria-hidden="true" />
        <span>
          Spell each name the way it should <em>sound</em>, using hyphens to break syllables
          (e.g. <code className="text-[#9080a0]">Em-ber-stran</code>). Myra swaps the written word for
          your spelling only when speaking — the text on the site is unchanged. Matching is
          case-insensitive and whole-word.
        </span>
      </p>
    </form>
  );
}
