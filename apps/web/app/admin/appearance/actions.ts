"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { readContent, writeContent } from "@/lib/contentFiles";
import { normalizeTheme, type Theme } from "@/lib/theme";
import { COLOR_KEYS, DEFAULT_THEME, SURFACE_KEYS } from "./themeConfig";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function saveAppearanceAction(formData: FormData) {
  await requireAdmin();

  const theme = normalizeTheme(readContent<Partial<Theme>>("theme.json"));

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
