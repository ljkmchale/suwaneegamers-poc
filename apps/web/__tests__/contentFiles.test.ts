import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { contentPath } from "@/lib/contentFiles";
import { loadTheme } from "@/lib/theme";

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
});
