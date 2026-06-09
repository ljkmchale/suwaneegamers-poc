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
  colors: {},
  surfaces: {},
  fonts: { heading: "Cinzel", body: "Lora" },
  siteName: "Suwanee Gamers",
  siteTagline: "The World of Myrdae",
};

export function normalizeTheme(theme: Partial<Theme> | null | undefined): Theme {
  return {
    ...FALLBACK_THEME,
    ...theme,
    colors: theme?.colors ?? FALLBACK_THEME.colors,
    surfaces: theme?.surfaces ?? FALLBACK_THEME.surfaces,
    fonts: {
      heading: theme?.fonts?.heading ?? FALLBACK_THEME.fonts.heading,
      body: theme?.fonts?.body ?? FALLBACK_THEME.fonts.body,
    },
    effects: theme?.effects,
  };
}

export function loadTheme(): Theme {
  try {
    return normalizeTheme(JSON.parse(fs.readFileSync(contentPath("theme.json"), "utf-8")) as Partial<Theme>);
  } catch {
    return normalizeTheme(null);
  }
}
