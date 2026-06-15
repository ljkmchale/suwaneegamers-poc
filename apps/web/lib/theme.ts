import fs from "fs";
import { contentPath } from "@/lib/contentFiles";

export interface Theme {
  colors: Record<string, string>;
  surfaces?: Record<string, string>;
  glowIntensity?: "none" | "subtle" | "normal" | "strong";
  effects?: {
    particles?: boolean;
    particleDensity?: "low" | "medium" | "high";
  };
  fonts: { heading: string; body: string };
  siteName?: string;
  siteTagline?: string;
}

const FALLBACK_THEME: Theme = {
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

export function normalizeTheme(theme: Partial<Theme> | null | undefined): Theme {
  return {
    ...FALLBACK_THEME,
    ...theme,
    colors: {
      ...FALLBACK_THEME.colors,
      ...(theme?.colors ?? {}),
    },
    surfaces: {
      ...FALLBACK_THEME.surfaces,
      ...(theme?.surfaces ?? {}),
    },
    fonts: {
      heading: theme?.fonts?.heading ?? FALLBACK_THEME.fonts.heading,
      body: theme?.fonts?.body ?? FALLBACK_THEME.fonts.body,
    },
    effects: {
      ...FALLBACK_THEME.effects,
      ...(theme?.effects ?? {}),
    },
  };
}

export function loadTheme(): Theme {
  try {
    return normalizeTheme(JSON.parse(fs.readFileSync(contentPath("theme.json"), "utf-8")) as Partial<Theme>);
  } catch {
    return normalizeTheme(null);
  }
}
