"use server";

import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/adminAuth";

const IMAGES_ROOT = path.join(process.cwd(), "media/images");

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif",
  ".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac",
  ".mp4", ".m4v", ".mov", ".ogv",
]);

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.+/g, ".")
    .slice(0, 120);
}

export async function uploadFilesAction(formData: FormData): Promise<{ uploaded: string[]; errors: string[] }> {
  await requireAdmin();

  const files = formData.getAll("files") as File[];
  const subfolder = (formData.get("subfolder") as string | null) ?? "";
  const uploaded: string[] = [];
  const errors: string[] = [];

  const targetDir = subfolder
    ? path.join(IMAGES_ROOT, sanitizeFilename(subfolder.replace(/^\/+/, "")))
    : IMAGES_ROOT;

  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of files) {
    if (!file || file.size === 0) continue;

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      errors.push(`${file.name}: unsupported file type`);
      continue;
    }

    const safe = sanitizeFilename(path.basename(file.name, ext)) + ext;
    const dest = path.join(targetDir, safe);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(dest, buffer);

    const relativePath = "/media/images/" + (subfolder ? subfolder.replace(/^\/+/, "") + "/" : "") + safe;
    uploaded.push(relativePath);
  }

  return { uploaded, errors };
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const filePath = formData.get("filePath") as string;
  if (!filePath || !filePath.startsWith("/media/images/")) return;

  const abs = path.join(process.cwd(), "public", filePath);
  // ensure the resolved path is still inside media/images
  if (!abs.startsWith(IMAGES_ROOT)) return;

  try {
    fs.unlinkSync(abs);
  } catch {
    // ignore if already gone
  }
}
