import fs from "fs";
import path from "path";
import type { Metadata } from "next";
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

interface Theme {
  colors: Record<string, string>;
  fonts: { heading: string; body: string };
  siteName?: string;
  siteTagline?: string;
}

function loadTheme(): Theme {
  try {
    const filePath = path.join(process.cwd(), "../../content/theme.json");
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Theme;
  } catch {
    return {
      colors: {},
      fonts: { heading: "Cinzel", body: "Lora" },
      siteName: "Suwanee Gamers",
      siteTagline: "The World of Myrdae",
    };
  }
}

function buildThemeStyle(theme: Theme): string {
  const headingVar = FONT_VAR_MAP[theme.fonts.heading] ?? "--font-cinzel";
  const bodyVar = FONT_VAR_MAP[theme.fonts.body] ?? "--font-lora";
  const colorEntries = Object.entries(theme.colors)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `:root {\n${colorEntries}\n  --font-heading: var(${headingVar});\n  --font-body: var(${bodyVar});\n}`;
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
