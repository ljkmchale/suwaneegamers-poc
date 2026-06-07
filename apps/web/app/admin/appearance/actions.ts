"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { readContent, writeContent } from "@/lib/contentFiles";
import type { Theme } from "@/lib/theme";

const COLOR_KEYS = [
  "--color-bg-deep",
  "--color-bg-surface",
  "--color-bg-card",
  "--color-bg-border",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-muted",
  "--color-accent-arcane",
  "--color-accent-gold",
  "--color-accent-blood",
  "--color-accent-ice",
];

const SURFACE_KEYS = [
  "--card-radius",
  "--card-blur",
  "--card-hover-border",
];

export const DEFAULT_THEME: Theme = {
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
  surfaces: {
    "--card-radius": "0.75rem",
    "--card-blur": "8px",
    "--card-hover-border": "#8b5cf6",
  },
  glowIntensity: "normal",
  effects: {
    particles: true,
    particleDensity: "medium",
  },
  fonts: { heading: "Cinzel", body: "Lora" },
  siteName: "Suwanee Gamers",
  siteTagline: "The World of Myrdae",
};

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function saveAppearanceAction(formData: FormData) {
  await requireAdmin();

  const theme = readContent<Theme>("theme.json");

  // Colors
  const colors: Record<string, string> = {};
  for (const key of COLOR_KEYS) {
    const val = formData.get(key) as string | null;
    if (val) colors[key] = val;
  }
  theme.colors = colors;

  // Surfaces
  const surfaces: Record<string, string> = {};
  for (const key of SURFACE_KEYS) {
    const val = formData.get(key) as string | null;
    if (val) surfaces[key] = val;
  }
  theme.surfaces = surfaces;

  // Glow intensity
  const glowIntensity = formData.get("glowIntensity") as string | null;
  if (glowIntensity) theme.glowIntensity = glowIntensity as Theme["glowIntensity"];

  // Fonts
  theme.fonts = {
    heading: (formData.get("fontHeading") as string) ?? theme.fonts.heading,
    body: (formData.get("fontBody") as string) ?? theme.fonts.body,
  };

  // Site identity
  const siteName = (formData.get("siteName") as string)?.trim();
  if (siteName) theme.siteName = siteName;
  const siteTagline = (formData.get("siteTagline") as string)?.trim();
  if (siteTagline) theme.siteTagline = siteTagline;

  // Effects
  theme.effects = {
    particles: formData.get("particles") === "true",
    particleDensity: (formData.get("particleDensity") as "low" | "medium" | "high") ?? "medium",
  };

  writeContent("theme.json", theme);
  revalidateAll();
}

export async function resetAppearanceAction() {
  await requireAdmin();
  writeContent("theme.json", DEFAULT_THEME);
  revalidateAll();
}

export { COLOR_KEYS, SURFACE_KEYS };
