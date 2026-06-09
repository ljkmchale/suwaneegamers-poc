import type { Metadata } from "next";
import { loadTheme, type Theme } from "@/lib/theme";
import {
  Cinzel,
  Lora,
  IM_Fell_English,
  Uncial_Antiqua,
  Spectral,
  Playfair_Display,
  Crimson_Text,
  MedievalSharp,
} from "next/font/google";
import "./globals.css";

// ── Curated font set (all pre-loaded at build; theme.json picks which is active) ──
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", weight: ["400", "600", "700", "900"] });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", style: ["normal", "italic"] });
const imFell = IM_Fell_English({ subsets: ["latin"], variable: "--font-im-fell", weight: "400", style: ["normal", "italic"] });
const uncial = Uncial_Antiqua({ subsets: ["latin"], variable: "--font-uncial", weight: "400" });
const spectral = Spectral({ subsets: ["latin"], variable: "--font-spectral", weight: ["400", "600", "700"] });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", weight: ["400", "600", "700"] });
const crimson = Crimson_Text({ subsets: ["latin"], variable: "--font-crimson", weight: ["400", "600"] });
const medieval = MedievalSharp({ subsets: ["latin"], variable: "--font-medieval", weight: "400" });

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


function hexToRgb(hex: string): string | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return `${r}, ${g}, ${b}`;
}

function buildGlow(colorHex: string, intensity: string): string {
  const rgb = hexToRgb(colorHex);
  if (!rgb || intensity === "none") return "none";
  if (intensity === "subtle") return `0 0 14px rgba(${rgb}, 0.25), 0 0 40px rgba(${rgb}, 0.07)`;
  if (intensity === "strong") return `0 0 25px rgba(${rgb}, 0.65), 0 0 80px rgba(${rgb}, 0.22)`;
  return `0 0 20px rgba(${rgb}, 0.4), 0 0 60px rgba(${rgb}, 0.1)`;
}

function buildThemeStyle(theme: Theme): string {
  const headingVar = FONT_VAR_MAP[theme.fonts?.heading] ?? "--font-cinzel";
  const bodyVar = FONT_VAR_MAP[theme.fonts?.body] ?? "--font-lora";

  const colorEntries = Object.entries(theme.colors ?? {})
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  const surfaceEntries = Object.entries(theme.surfaces ?? {})
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  const arcane = theme.colors?.["--color-accent-arcane"] ?? "#8b5cf6";
  const gold = theme.colors?.["--color-accent-gold"] ?? "#f59e0b";
  const intensity = theme.glowIntensity ?? "normal";
  const glowEntries = [
    `  --glow-arcane: ${buildGlow(arcane, intensity)};`,
    `  --glow-gold: ${buildGlow(gold, intensity)};`,
  ].join("\n");

  const parts = [colorEntries, surfaceEntries, glowEntries].filter(Boolean).join("\n");
  return `:root {\n${parts}\n  --font-heading: var(${headingVar});\n  --font-body: var(${bodyVar});\n}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const theme = loadTheme();
  const siteName = theme.siteName ?? "Suwanee Gamers";
  const siteTagline = theme.siteTagline ?? "The World of Myrdae";
  return {
    title: { template: `%s | ${siteName}`, default: `${siteName} — ${siteTagline}` },
    description:
      "Eight campaigns. Four Dungeon Masters. One living world. The official campaign portal for Suwanee Gamers — explore the world of Myrdae, track campaigns, and follow upcoming sessions.",
    icons: {
      icon: "/images/suwaneegamers-logo.png",
      shortcut: "/images/suwaneegamers-logo.png",
      apple: "/images/suwaneegamers-logo.png",
    },
    openGraph: {
      title: siteName,
      description: `${siteTagline} — Year 1246 AF, The Awakening`,
      type: "website",
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = loadTheme();
  const themeStyle = buildThemeStyle(theme);

  const fontClasses = [
    cinzel.variable, lora.variable, imFell.variable, uncial.variable,
    spectral.variable, playfair.variable, crimson.variable, medieval.variable,
  ].join(" ");

  return (
    <html lang="en" className={fontClasses}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
