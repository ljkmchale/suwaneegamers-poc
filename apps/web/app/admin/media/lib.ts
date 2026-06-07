import fs from "fs";
import path from "path";

const PUBLIC_IMAGES = path.join(process.cwd(), "public/images");

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
  const dir = subfolder ? path.join(PUBLIC_IMAGES, subfolder) : PUBLIC_IMAGES;
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && ALLOWED_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => {
      const rel = "/images/" + (subfolder ? subfolder + "/" : "") + e.name;
      const stats = fs.statSync(path.join(dir, e.name));
      return { path: rel, name: e.name, size: stats.size };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listSubfolders(): string[] {
  if (!fs.existsSync(PUBLIC_IMAGES)) return [];
  return fs.readdirSync(PUBLIC_IMAGES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}
