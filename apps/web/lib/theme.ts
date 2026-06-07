import fs from "fs";
import path from "path";

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

export function loadTheme(): Theme {
  try {
    const filePath = path.join(process.cwd(), "../../content/theme.json");
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Theme;
  } catch {
    return {
      colors: {},
      surfaces: {},
      fonts: { heading: "Cinzel", body: "Lora" },
      siteName: "Suwanee Gamers",
      siteTagline: "The World of Myrdae",
    };
  }
}
