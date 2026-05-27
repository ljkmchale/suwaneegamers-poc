import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

const PUBLIC_IMAGES = path.join(process.cwd(), "public/images");
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"]);

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
      path: `/images/${rel.replaceAll("\\", "/")}`,
      name: entry.name,
      size: stats.size,
    }];
  });
}

export async function GET() {
  await requireAdmin();
  const files = walkImages(PUBLIC_IMAGES).sort((a, b) => a.path.localeCompare(b.path));
  return NextResponse.json({ files });
}
