import fs from "fs";
import path from "path";

const IMAGES_ROOT = path.join(process.cwd(), "media/images");

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif",
  ".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac",
  ".mp4", ".m4v", ".mov", ".ogv",
]);

export interface MediaFile {
  path: string;
  name: string;
  size: number;
}

export function listMediaFiles(subfolder?: string): MediaFile[] {
  const dir = subfolder ? path.join(IMAGES_ROOT, subfolder) : IMAGES_ROOT;
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && ALLOWED_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => {
      const rel = "/media/images/" + (subfolder ? subfolder + "/" : "") + e.name;
      const stats = fs.statSync(path.join(dir, e.name));
      return { path: rel, name: e.name, size: stats.size };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listSubfolders(): string[] {
  if (!fs.existsSync(IMAGES_ROOT)) return [];
  return fs.readdirSync(IMAGES_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}
