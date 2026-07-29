import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

const IMAGES_ROOT = path.join(process.cwd(), "media/images");
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif",
  ".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac",
  ".mp4", ".m4v", ".mov", ".ogv",
]);

interface MediaFile {
  path: string;
  name: string;
  size: number;
}

function walkImages(dir: string, relDir = ""): MediaFile[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = path.join(dir, entry.name);
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      return walkImages(abs, rel);
    }

    if (!entry.isFile() || !ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      return [];
    }

    const stats = fs.statSync(abs);
    return [{
      path: `/media/images/${rel.replaceAll("\\", "/")}`,
      name: entry.name,
      size: stats.size,
    }];
  });
}

export async function GET() {
  await requireAdmin();
  const files = walkImages(IMAGES_ROOT).sort((a, b) => a.path.localeCompare(b.path));
  return NextResponse.json({ files });
}
