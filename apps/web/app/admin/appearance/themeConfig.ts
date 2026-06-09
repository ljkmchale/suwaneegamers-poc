import type { Theme } from "@/lib/theme";

export const COLOR_KEYS = [
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

export const SURFACE_KEYS = [
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
