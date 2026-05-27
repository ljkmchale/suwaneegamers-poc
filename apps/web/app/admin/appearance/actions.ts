"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { readContent, writeContent } from "@/lib/contentFiles";

interface Theme {
  colors: Record<string, string>;
  fonts: { heading: string; body: string };
  siteName?: string;
  siteTagline?: string;
}

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

export async function saveAppearanceAction(formData: FormData) {
  await requireAdmin();

  const theme = readContent<Theme>("theme.json");

  const colors: Record<string, string> = {};
  for (const key of COLOR_KEYS) {
    const val = formData.get(key) as string | null;
    if (val) colors[key] = val;
  }

  theme.colors = colors;
  theme.fonts = {
    heading: (formData.get("fontHeading") as string) ?? theme.fonts.heading,
    body: (formData.get("fontBody") as string) ?? theme.fonts.body,
  };
  theme.siteName = (formData.get("siteName") as string)?.trim() || theme.siteName;
  theme.siteTagline = (formData.get("siteTagline") as string)?.trim() || theme.siteTagline;

  writeContent("theme.json", theme);

  revalidatePath("/", "layout");
  revalidatePath("/campaigns");
  revalidatePath("/players");
  revalidatePath("/dungeon-masters");
  revalidatePath("/bestiary");
}

export async function resetColorsAction() {
  await requireAdmin();

  const theme = readContent<Theme>("theme.json");
  theme.colors = {
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
  };
  writeContent("theme.json", theme);
  revalidatePath("/", "layout");
}

export { COLOR_KEYS };
