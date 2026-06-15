import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { contentPath } from "@/lib/contentFiles";
import { loadTheme, normalizeTheme } from "@/lib/theme";

const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
});

describe("content file resolution", () => {
  it("finds content files from the repo root", () => {
    process.chdir(path.resolve(__dirname, "../../.."));

    expect(fs.existsSync(contentPath("theme.json"))).toBe(true);
    expect(loadTheme().fonts.heading).toBeTruthy();
  });

  it("finds content files from the web app directory", () => {
    process.chdir(path.resolve(__dirname, ".."));

    expect(fs.existsSync(contentPath("theme.json"))).toBe(true);
    expect(loadTheme().fonts.body).toBeTruthy();
  });

  it("normalizes partial themes with editable appearance defaults", () => {
    const theme = normalizeTheme({ colors: {} });

    expect(theme.colors["--color-bg-deep"]).toBe("#08050f");
    expect(theme.colors["--color-accent-arcane"]).toBe("#8b5cf6");
    expect(theme.surfaces?.["--card-radius"]).toBe("0.75rem");
    expect(theme.effects?.particles).toBe(true);
  });
});
