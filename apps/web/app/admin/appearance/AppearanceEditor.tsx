"use client";

import { useState, useTransition } from "react";
import { saveAppearanceAction, resetColorsAction } from "./actions";

const FONT_OPTIONS = [
  "Cinzel",
  "Lora",
  "IM Fell English",
  "Uncial Antiqua",
  "Spectral",
  "Playfair Display",
  "Crimson Text",
  "MedievalSharp",
];

const COLOR_GROUPS = [
  {
    label: "Backgrounds",
    keys: [
      { key: "--color-bg-deep", label: "Deep Background" },
      { key: "--color-bg-surface", label: "Surface Background" },
      { key: "--color-bg-card", label: "Card Background" },
      { key: "--color-bg-border", label: "Border" },
    ],
  },
  {
    label: "Text",
    keys: [
      { key: "--color-text-primary", label: "Primary Text" },
      { key: "--color-text-secondary", label: "Secondary Text" },
      { key: "--color-text-muted", label: "Muted Text" },
    ],
  },
  {
    label: "Accents",
    keys: [
      { key: "--color-accent-arcane", label: "Arcane (purple)" },
      { key: "--color-accent-gold", label: "Gold" },
      { key: "--color-accent-blood", label: "Blood (red)" },
      { key: "--color-accent-ice", label: "Ice (blue)" },
    ],
  },
];

interface Theme {
  colors: Record<string, string>;
  fonts: { heading: string; body: string };
  siteName?: string;
  siteTagline?: string;
}

const FONT_VAR_MAP: Record<string, string> = {
  Cinzel: "--font-cinzel",
  Lora: "--font-lora",
  "IM Fell English": "--font-im-fell",
  "Uncial Antiqua": "--font-uncial",
  Spectral: "--font-spectral",
  "Playfair Display": "--font-playfair",
  "Crimson Text": "--font-crimson",
  MedievalSharp: "--font-medieval",
};

const INPUT = "w-full px-3 py-2 rounded border border-[#2a2a35] bg-[#16161e] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] text-sm";
const LABEL = "block mb-1 text-xs font-cinzel tracking-widest uppercase text-[#a89880]";

export function AppearanceEditor({ initial }: { initial: Theme }) {
  const [colors, setColors] = useState(initial.colors);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleColorChange(key: string, value: string) {
    setColors((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await saveAppearanceAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  function handleReset() {
    if (!confirm("Reset all colors to the default fantasy theme?")) return;
    startTransition(async () => {
      await resetColorsAction();
      window.location.reload();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Site Identity */}
      <section>
        <h2 className="font-cinzel text-lg tracking-widest uppercase mb-4 text-[#f59e0b]">Site Identity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className={LABEL}>Site Name</label>
            <input name="siteName" defaultValue={initial.siteName ?? "Suwanee Gamers"} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Tagline</label>
            <input name="siteTagline" defaultValue={initial.siteTagline ?? "The World of Myrdae"} className={INPUT} />
          </div>
        </div>
      </section>

      {/* Fonts */}
      <section>
        <h2 className="font-cinzel text-lg tracking-widest uppercase mb-4 text-[#f59e0b]">Fonts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className={LABEL}>Heading Font</label>
            <select name="fontHeading" defaultValue={initial.fonts.heading} className={INPUT}>
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: `var(${FONT_VAR_MAP[f] ?? "--font-cinzel"})` }}>{f}</option>
              ))}
            </select>
            <p className="text-xs text-[#5a5060] mt-1">Used for titles and section headers.</p>
          </div>
          <div>
            <label className={LABEL}>Body Font</label>
            <select name="fontBody" defaultValue={initial.fonts.body} className={INPUT}>
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <p className="text-xs text-[#5a5060] mt-1">Used for descriptions and paragraph text.</p>
          </div>
        </div>
      </section>

      {/* Colors */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-cinzel text-lg tracking-widest uppercase text-[#f59e0b]">Colors</h2>
          <button type="button" onClick={handleReset}
            className="text-xs text-[#5a5060] hover:text-[#a89880] border border-[#2a2a35] px-3 py-1.5 rounded transition-colors">
            Reset to defaults
          </button>
        </div>

        <div className="space-y-8">
          {COLOR_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-cinzel tracking-widest uppercase text-[#5a5060] mb-3">{group.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {group.keys.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        name={key}
                        value={colors[key] ?? "#000000"}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-[#2a2a35] bg-transparent p-0.5"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{label}</p>
                      <p className="text-xs text-[#5a5060] font-mono">{colors[key]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4 pt-6 border-t border-[#2a2a35]">
        <button type="submit" disabled={pending}
          className="px-6 py-2.5 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors disabled:opacity-50">
          {pending ? "Saving…" : "Save Appearance"}
        </button>
        {saved && <p className="text-sm text-green-400">Saved! Reload the public site to see changes.</p>}
      </div>
    </form>
  );
}
