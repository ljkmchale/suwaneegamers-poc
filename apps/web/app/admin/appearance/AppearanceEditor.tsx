"use client";

import { useState, useTransition, useMemo } from "react";
import { saveAppearanceAction, resetAppearanceAction } from "./actions";
import type { Theme } from "@/lib/theme";

// ── Fonts ─────────────────────────────────────────────────────────────────────

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

// ── Preset Themes ─────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  name: string;
  desc: string;
  swatches: string[];
  colors: Record<string, string>;
  surfaces: Record<string, string>;
  glowIntensity: "none" | "subtle" | "normal" | "strong";
  fonts: { heading: string; body: string };
}

const PRESETS: Preset[] = [
  {
    id: "fantasy-dark",
    name: "Fantasy Dark",
    desc: "Arcane purple and ancient gold on deep shadow.",
    swatches: ["#08050f", "#8b5cf6", "#f59e0b", "#e8dfc8"],
    colors: {
      "--color-bg-deep": "#08050f",
      "--color-bg-surface": "#0f0a1a",
      "--color-bg-card": "#16161e",
      "--color-bg-border": "#2a2a35",
      "--color-text-primary": "#e8dfc8",
      "--color-text-secondary": "#a89880",
      "--color-text-muted": "#5a5060",
      "--color-accent-arcane": "#8b5cf6",
      "--color-accent-gold": "#f59e0b",
      "--color-accent-blood": "#ef4444",
      "--color-accent-ice": "#93c5fd",
    },
    surfaces: { "--card-radius": "0.75rem", "--card-blur": "8px", "--card-hover-border": "#8b5cf6" },
    glowIntensity: "normal",
    fonts: { heading: "Cinzel", body: "Lora" },
  },
  {
    id: "blood-and-bone",
    name: "Blood & Bone",
    desc: "Crimson death and the stench of the battlefield.",
    swatches: ["#0a0404", "#ef4444", "#f97316", "#f0e6e6"],
    colors: {
      "--color-bg-deep": "#0a0404",
      "--color-bg-surface": "#160808",
      "--color-bg-card": "#1e0f0f",
      "--color-bg-border": "#3a2020",
      "--color-text-primary": "#f0e6e6",
      "--color-text-secondary": "#c8a0a0",
      "--color-text-muted": "#7a5050",
      "--color-accent-arcane": "#ef4444",
      "--color-accent-gold": "#f97316",
      "--color-accent-blood": "#dc2626",
      "--color-accent-ice": "#fca5a5",
    },
    surfaces: { "--card-radius": "0.375rem", "--card-blur": "8px", "--card-hover-border": "#ef4444" },
    glowIntensity: "normal",
    fonts: { heading: "Cinzel", body: "Crimson Text" },
  },
  {
    id: "arcane-frost",
    name: "Arcane Frost",
    desc: "Ice-blue arcane power in the frozen north.",
    swatches: ["#03050f", "#60a5fa", "#e2e8f0", "#e0eefc"],
    colors: {
      "--color-bg-deep": "#03050f",
      "--color-bg-surface": "#080f1a",
      "--color-bg-card": "#0f1826",
      "--color-bg-border": "#1e2d3a",
      "--color-text-primary": "#e0eefc",
      "--color-text-secondary": "#8ab0d0",
      "--color-text-muted": "#4a6070",
      "--color-accent-arcane": "#60a5fa",
      "--color-accent-gold": "#e2e8f0",
      "--color-accent-blood": "#f472b6",
      "--color-accent-ice": "#93c5fd",
    },
    surfaces: { "--card-radius": "0.75rem", "--card-blur": "12px", "--card-hover-border": "#60a5fa" },
    glowIntensity: "normal",
    fonts: { heading: "Cinzel", body: "Spectral" },
  },
  {
    id: "shadow-court",
    name: "Shadow Court",
    desc: "Emerald shadows and the whisper of the fey.",
    swatches: ["#040a06", "#10b981", "#a3e635", "#dceee0"],
    colors: {
      "--color-bg-deep": "#040a06",
      "--color-bg-surface": "#08140a",
      "--color-bg-card": "#0f1e12",
      "--color-bg-border": "#1e3022",
      "--color-text-primary": "#dceee0",
      "--color-text-secondary": "#8ab898",
      "--color-text-muted": "#4a6050",
      "--color-accent-arcane": "#10b981",
      "--color-accent-gold": "#a3e635",
      "--color-accent-blood": "#ef4444",
      "--color-accent-ice": "#6ee7b7",
    },
    surfaces: { "--card-radius": "0.75rem", "--card-blur": "8px", "--card-hover-border": "#10b981" },
    glowIntensity: "subtle",
    fonts: { heading: "Uncial Antiqua", body: "Lora" },
  },
  {
    id: "sun-and-steel",
    name: "Sun & Steel",
    desc: "Hearth-fire warmth and the gleam of forged steel.",
    swatches: ["#120d04", "#f59e0b", "#d97706", "#f5e8c8"],
    colors: {
      "--color-bg-deep": "#120d04",
      "--color-bg-surface": "#1c1508",
      "--color-bg-card": "#241c0c",
      "--color-bg-border": "#3a2e16",
      "--color-text-primary": "#f5e8c8",
      "--color-text-secondary": "#c8a870",
      "--color-text-muted": "#7a6040",
      "--color-accent-arcane": "#d97706",
      "--color-accent-gold": "#f59e0b",
      "--color-accent-blood": "#ef4444",
      "--color-accent-ice": "#fcd34d",
    },
    surfaces: { "--card-radius": "0.375rem", "--card-blur": "4px", "--card-hover-border": "#f59e0b" },
    glowIntensity: "subtle",
    fonts: { heading: "Cinzel", body: "IM Fell English" },
  },
  {
    id: "voidwalker",
    name: "Voidwalker",
    desc: "Pure void with neon arcane fire.",
    swatches: ["#000000", "#a855f7", "#eab308", "#f0f0ff"],
    colors: {
      "--color-bg-deep": "#000000",
      "--color-bg-surface": "#08080e",
      "--color-bg-card": "#0e0e18",
      "--color-bg-border": "#1e1e2e",
      "--color-text-primary": "#f0f0ff",
      "--color-text-secondary": "#9090c0",
      "--color-text-muted": "#404068",
      "--color-accent-arcane": "#a855f7",
      "--color-accent-gold": "#eab308",
      "--color-accent-blood": "#f43f5e",
      "--color-accent-ice": "#38bdf8",
    },
    surfaces: { "--card-radius": "0rem", "--card-blur": "0px", "--card-hover-border": "#a855f7" },
    glowIntensity: "strong",
    fonts: { heading: "MedievalSharp", body: "Spectral" },
  },
];

// ── Color groups ───────────────────────────────────────────────────────────────

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
      { key: "--color-accent-arcane", label: "Arcane" },
      { key: "--color-accent-gold", label: "Gold" },
      { key: "--color-accent-blood", label: "Blood" },
      { key: "--color-accent-ice", label: "Ice" },
    ],
  },
];

// ── Surface option sets ────────────────────────────────────────────────────────

const RADIUS_OPTIONS = [
  { label: "Sharp", value: "0rem" },
  { label: "Slight", value: "0.375rem" },
  { label: "Rounded", value: "0.75rem" },
  { label: "Round", value: "1.5rem" },
];

const BLUR_OPTIONS = [
  { label: "None", value: "0px" },
  { label: "Light", value: "4px" },
  { label: "Normal", value: "8px" },
  { label: "Heavy", value: "16px" },
];

const GLOW_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Subtle", value: "subtle" },
  { label: "Normal", value: "normal" },
  { label: "Strong", value: "strong" },
];

// ── Preset matching ───────────────────────────────────────────────────────────

function matchPreset(
  colors: Record<string, string>,
  surfaces: Record<string, string>,
  glowIntensity: string,
  fonts: { heading: string; body: string },
): string | null {
  for (const preset of PRESETS) {
    const colorsMatch = Object.keys(preset.colors).every(
      (k) => (colors[k] ?? "").toLowerCase() === preset.colors[k].toLowerCase(),
    );
    const surfacesMatch = Object.keys(preset.surfaces).every(
      (k) => surfaces[k] === preset.surfaces[k],
    );
    if (
      colorsMatch &&
      surfacesMatch &&
      glowIntensity === preset.glowIntensity &&
      fonts.heading === preset.fonts.heading &&
      fonts.body === preset.fonts.body
    ) {
      return preset.id;
    }
  }
  return null;
}

// ── Style constants ────────────────────────────────────────────────────────────

const INPUT = "w-full px-3 py-2 rounded border border-[#2a2a35] bg-[#16161e] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] text-sm";
const LABEL = "block mb-1 text-xs font-cinzel tracking-widest uppercase text-[#a89880]";
const SECTION_TITLE = "font-cinzel text-base tracking-widest uppercase mb-4 text-[#f59e0b]";

// ── Helpers ────────────────────────────────────────────────────────────────────

function OptionStrip({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-cinzel tracking-widest uppercase border transition-colors"
            style={{
              borderColor: active ? "#8b5cf6" : "#2a2a35",
              background: active ? "rgba(139,92,246,0.15)" : "#16161e",
              color: active ? "#c4b5fd" : "#a89880",
            }}
          >
            {active && <span style={{ color: "#8b5cf6" }}>✓</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ColorRow({ colorKey, label, value, onChange }: {
  colorKey: string;
  label: string;
  value: string;
  onChange: (key: string, val: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <input
          type="color"
          name={colorKey}
          value={value ?? "#000000"}
          onChange={(e) => onChange(colorKey, e.target.value)}
          className="w-10 h-10 rounded cursor-pointer border border-[#2a2a35] bg-transparent p-0.5"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{label}</p>
        <p className="text-xs text-[#5a5060] font-mono">{value}</p>
      </div>
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "presets", label: "Presets" },
  { id: "identity", label: "Identity & Fonts" },
  { id: "colors", label: "Colors" },
  { id: "cards", label: "Cards & Surfaces" },
  { id: "effects", label: "Effects" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Main Editor ────────────────────────────────────────────────────────────────

export function AppearanceEditor({ initial }: { initial: Theme }) {
  const [tab, setTab] = useState<TabId>("presets");
  const [colors, setColors] = useState(initial.colors);
  const [surfaces, setSurfaces] = useState(initial.surfaces ?? {
    "--card-radius": "0.75rem",
    "--card-blur": "8px",
    "--card-hover-border": "#8b5cf6",
  });
  const [glowIntensity, setGlowIntensity] = useState(initial.glowIntensity ?? "normal");
  const [fonts, setFonts] = useState(initial.fonts);
  const [siteName, setSiteName] = useState(initial.siteName ?? "Suwanee Gamers");
  const [siteTagline, setSiteTagline] = useState(initial.siteTagline ?? "The World of Myrdae");
  const [particles, setParticles] = useState(initial.effects?.particles !== false);
  const [particleDensity, setParticleDensity] = useState(initial.effects?.particleDensity ?? "medium");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  // Which preset matches the currently saved (initial) values
  const savedPresetId = useMemo(
    () => matchPreset(
      initial.colors,
      initial.surfaces ?? {},
      initial.glowIntensity ?? "normal",
      initial.fonts,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Which preset matches the current form state (updates as user makes changes)
  const activePresetId = matchPreset(colors, surfaces, glowIntensity, fonts);

  function applyPreset(preset: Preset) {
    setColors(preset.colors);
    setSurfaces(preset.surfaces);
    setGlowIntensity(preset.glowIntensity);
    setFonts(preset.fonts);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Ensure hidden state fields are present
    fd.set("particles", String(particles));
    fd.set("particleDensity", particleDensity);
    fd.set("glowIntensity", glowIntensity);
    fd.set("--card-radius", surfaces["--card-radius"] ?? "0.75rem");
    fd.set("--card-blur", surfaces["--card-blur"] ?? "8px");
    fd.set("--card-hover-border", surfaces["--card-hover-border"] ?? "#8b5cf6");
    startTransition(async () => {
      await saveAppearanceAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  function handleReset() {
    if (!confirm("Reset to the default Fantasy Dark theme?")) return;
    startTransition(async () => {
      await resetAppearanceAction();
      window.location.reload();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Hidden fields for state not captured by native inputs */}
      <input type="hidden" name="particles" value={String(particles)} />
      <input type="hidden" name="particleDensity" value={particleDensity} />
      <input type="hidden" name="glowIntensity" value={glowIntensity} />
      <input type="hidden" name="--card-radius" value={surfaces["--card-radius"] ?? "0.75rem"} />
      <input type="hidden" name="--card-blur" value={surfaces["--card-blur"] ?? "8px"} />

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 border-b border-[#2a2a35] pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-xs font-cinzel tracking-widest uppercase transition-colors border-b-2 -mb-px"
            style={{
              borderBottomColor: tab === t.id ? "#8b5cf6" : "transparent",
              color: tab === t.id ? "#c4b5fd" : "#5a5060",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Presets ─────────────────────────────────────────────────── */}
      {tab === "presets" && (
        <div className="space-y-4">
          <p className="text-sm text-[#a89880] mb-6">
            Apply a full theme preset — colors, fonts, card style, and glow intensity all at once.
            You can fine-tune any setting afterward.
          </p>
          {!savedPresetId && (
            <p className="text-xs text-[#5a5060] mb-4 px-3 py-2 rounded border border-[#2a2a35] bg-[#16161e]">
              Your current theme is a custom configuration — no preset matches it exactly.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PRESETS.map((preset) => {
              const isSaved = preset.id === savedPresetId;
              const isSelected = preset.id === activePresetId;
              const isCurrentAndSaved = isSaved && isSelected;
              const borderColor = isCurrentAndSaved
                ? "#f59e0b"
                : isSelected
                ? "#8b5cf6"
                : isSaved
                ? "rgba(245,158,11,0.4)"
                : "#2a2a35";

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="text-left p-4 rounded-lg border transition-all group relative"
                  style={{
                    borderColor,
                    background: isSelected ? "rgba(139,92,246,0.07)" : "#0f0a1a",
                    boxShadow: isCurrentAndSaved ? "0 0 0 1px rgba(245,158,11,0.2)" : undefined,
                  }}
                >
                  {/* Status badge */}
                  {(isSaved || isSelected) && (
                    <div className="absolute top-3 right-3 flex gap-1">
                      {isSaved && (
                        <span
                          className="text-[10px] font-cinzel tracking-widest uppercase px-1.5 py-0.5 rounded"
                          style={{
                            background: "rgba(245,158,11,0.15)",
                            color: "#f59e0b",
                            border: "1px solid rgba(245,158,11,0.3)",
                          }}
                        >
                          {isSelected ? "Current" : "Saved"}
                        </span>
                      )}
                      {isSelected && !isSaved && (
                        <span
                          className="text-[10px] font-cinzel tracking-widest uppercase px-1.5 py-0.5 rounded"
                          style={{
                            background: "rgba(139,92,246,0.15)",
                            color: "#c4b5fd",
                            border: "1px solid rgba(139,92,246,0.3)",
                          }}
                        >
                          Selected
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    {preset.swatches.map((s) => (
                      <span key={s} className="w-4 h-4 rounded-full border border-white/10" style={{ background: s }} />
                    ))}
                  </div>
                  <p className="font-cinzel text-sm tracking-widest uppercase group-hover:text-[#f59e0b] transition-colors text-[#e8dfc8] pr-16">
                    {preset.name}
                  </p>
                  <p className="text-xs text-[#5a5060] mt-1">{preset.desc}</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[#5a5060] pt-2">
            Clicking a preset updates the form — hit <strong className="text-[#a89880]">Save Appearance</strong> at the bottom to apply it to the live site.
          </p>
        </div>
      )}

      {/* ── Tab: Identity & Fonts ─────────────────────────────────────────── */}
      {tab === "identity" && (
        <div className="space-y-8">
          <section>
            <h2 className={SECTION_TITLE}>Site Identity</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className={LABEL}>Site Name</label>
                <input
                  name="siteName"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Tagline</label>
                <input
                  name="siteTagline"
                  value={siteTagline}
                  onChange={(e) => setSiteTagline(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className={SECTION_TITLE}>Typography</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className={LABEL}>Heading Font</label>
                <select
                  name="fontHeading"
                  value={fonts.heading}
                  onChange={(e) => setFonts((f) => ({ ...f, heading: e.target.value }))}
                  className={INPUT}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: `var(${FONT_VAR_MAP[f] ?? "--font-cinzel"})` }}>
                      {f}
                    </option>
                  ))}
                </select>
                <p
                  className="mt-2 text-lg"
                  style={{ fontFamily: `var(${FONT_VAR_MAP[fonts.heading] ?? "--font-cinzel"})`, color: "#f59e0b" }}
                >
                  The Age of Awakening
                </p>
              </div>
              <div>
                <label className={LABEL}>Body Font</label>
                <select
                  name="fontBody"
                  value={fonts.body}
                  onChange={(e) => setFonts((f) => ({ ...f, body: e.target.value }))}
                  className={INPUT}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ fontFamily: `var(${FONT_VAR_MAP[fonts.body] ?? "--font-lora"})`, color: "#a89880" }}
                >
                  In the year 1246 AF, the old gods fell silent and the world held its breath.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── Tab: Colors ───────────────────────────────────────────────────── */}
      {tab === "colors" && (
        <div className="space-y-8">
          {COLOR_GROUPS.map((group) => (
            <section key={group.label}>
              <h2 className={SECTION_TITLE}>{group.label}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {group.keys.map(({ key, label }) => (
                  <ColorRow
                    key={key}
                    colorKey={key}
                    label={label}
                    value={colors[key] ?? "#000000"}
                    onChange={(k, v) => setColors((prev) => ({ ...prev, [k]: v }))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Tab: Cards & Surfaces ─────────────────────────────────────────── */}
      {tab === "cards" && (
        <div className="space-y-8">
          <section>
            <h2 className={SECTION_TITLE}>Card Border Radius</h2>
            <OptionStrip
              options={RADIUS_OPTIONS}
              value={surfaces["--card-radius"] ?? "0.75rem"}
              onChange={(v) => setSurfaces((s) => ({ ...s, "--card-radius": v }))}
            />
            <div
              className="mt-4 p-4 border text-sm text-[#a89880]"
              style={{
                borderColor: "#2a2a35",
                borderRadius: surfaces["--card-radius"] ?? "0.75rem",
                background: "#16161e",
              }}
            >
              Preview — card corner radius
            </div>
          </section>

          <section>
            <h2 className={SECTION_TITLE}>Card Backdrop Blur</h2>
            <OptionStrip
              options={BLUR_OPTIONS}
              value={surfaces["--card-blur"] ?? "8px"}
              onChange={(v) => setSurfaces((s) => ({ ...s, "--card-blur": v }))}
            />
            <p className="text-xs text-[#5a5060] mt-2">
              Controls the frosted-glass blur behind cards. Higher values are more opaque.
            </p>
          </section>

          <section>
            <h2 className={SECTION_TITLE}>Card Hover Border Color</h2>
            <div className="flex items-center gap-4">
              <input
                type="color"
                name="--card-hover-border"
                value={surfaces["--card-hover-border"] ?? "#8b5cf6"}
                onChange={(e) => setSurfaces((s) => ({ ...s, "--card-hover-border": e.target.value }))}
                className="w-10 h-10 rounded cursor-pointer border border-[#2a2a35] bg-transparent p-0.5"
              />
              <div>
                <p className="text-sm text-[#e8dfc8]">Hover border</p>
                <p className="text-xs text-[#5a5060] font-mono">{surfaces["--card-hover-border"] ?? "#8b5cf6"}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className={SECTION_TITLE}>Glow Intensity</h2>
            <OptionStrip
              options={GLOW_OPTIONS}
              value={glowIntensity}
              onChange={(v) => setGlowIntensity(v as "none" | "subtle" | "normal" | "strong")}
            />
            <p className="text-xs text-[#5a5060] mt-2">
              Controls the box-shadow glow on cards and accents. Uses the Arcane and Gold accent colors.
            </p>
          </section>
        </div>
      )}

      {/* ── Tab: Effects ──────────────────────────────────────────────────── */}
      {tab === "effects" && (
        <div className="space-y-8">
          <section>
            <h2 className={SECTION_TITLE}>Particle Field</h2>
            <div className="flex items-center gap-4 mb-4">
              <button
                type="button"
                onClick={() => setParticles((v) => !v)}
                className="relative w-12 h-6 rounded-full border transition-colors"
                style={{
                  background: particles ? "rgba(139,92,246,0.4)" : "#16161e",
                  borderColor: particles ? "#8b5cf6" : "#2a2a35",
                }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                  style={{
                    background: particles ? "#8b5cf6" : "#5a5060",
                    transform: particles ? "translateX(1.375rem)" : "translateX(0.125rem)",
                  }}
                />
              </button>
              <span className="text-sm" style={{ color: particles ? "#e8dfc8" : "#5a5060" }}>
                {particles ? "Enabled" : "Disabled"}
              </span>
            </div>

            {particles && (
              <>
                <label className={LABEL}>Density</label>
                <OptionStrip
                  options={[
                    { label: "Low", value: "low" },
                    { label: "Medium", value: "medium" },
                    { label: "High", value: "high" },
                  ]}
                  value={particleDensity}
                  onChange={(v) => setParticleDensity(v as "low" | "medium" | "high")}
                />
                <p className="text-xs text-[#5a5060] mt-2">
                  Low = 25 particles · Medium = 60 · High = 120. High may impact performance on older devices.
                </p>
              </>
            )}
          </section>
        </div>
      )}

      {/* ── Save bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pt-8 mt-8 border-t border-[#2a2a35]">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-2.5 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Appearance"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2.5 rounded font-cinzel text-xs tracking-widest uppercase border border-[#2a2a35] text-[#5a5060] hover:text-[#a89880] hover:border-[#5a5060] transition-colors"
        >
          Reset to defaults
        </button>
        {saved && (
          <p className="text-sm text-green-400">
            ✓ Saved — reload the public site to see all changes.
          </p>
        )}
      </div>
    </form>
  );
}
