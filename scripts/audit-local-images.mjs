// Ensure site-rendered images are served from this app rather than remote hosts.
// External links and intentional media embeds (Spotify, YouTube, audio/video) are excluded.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./sync-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "apps", "web", "public");
// Images moved out of public/ and are served by app/media/images/[...segments],
// so a /media/images/... URL resolves under apps/web/media, not apps/web/public.
const mediaDir = path.join(root, "apps", "web", "media");
const MEDIA_URL_PREFIX = "/media/";

function resolveLocalPath(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (pathname.startsWith(MEDIA_URL_PREFIX)) {
    return path.join(mediaDir, ...segments.slice(1));
  }
  return path.join(publicDir, ...segments);
}
const imageKeys = /^(image|imageUrl|image_url|headerImage|header_image|logo|artwork|portrait|banner|cover|thumbnail|symbol|icon)$/i;
const imageBlockTypes = new Set(["image", "deity-card", "campaign-hero"]);
const remote = [];
const missing = [];

function inspectImage(value, location) {
  if (typeof value !== "string" || !value.trim()) return;
  if (/^https?:\/\//i.test(value)) {
    remote.push({ location, value });
    return;
  }
  if (!value.startsWith("/")) return;

  const pathname = value.split(/[?#]/, 1)[0];
  if (!fs.existsSync(resolveLocalPath(pathname))) missing.push({ location, value });
}

function walk(value, location, parentType = "") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${location}[${index}]`, parentType));
    return;
  }
  if (!value || typeof value !== "object") return;

  const currentType = typeof value.type === "string" ? value.type : parentType;
  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    const isImageProp = imageKeys.test(key)
      || (key === "src" && imageBlockTypes.has(currentType));
    if (isImageProp) inspectImage(child, childLocation);

    if (typeof child === "string" && /^[\[{]/.test(child.trim())) {
      try {
        walk(JSON.parse(child), `${childLocation}{json}`, currentType);
      } catch {
        // Ordinary text that happens to start with a bracket is not nested JSON.
      }
    } else {
      walk(child, childLocation, currentType);
    }
  }
}

const contentDir = path.join(root, "content");
for (const relativePath of fs.readdirSync(contentDir, { recursive: true })) {
  if (!relativePath.endsWith(".json")) continue;
  const absolutePath = path.join(contentDir, relativePath);
  try {
    walk(JSON.parse(fs.readFileSync(absolutePath, "utf8")), `content/${relativePath}`);
  } catch (error) {
    throw new Error(`Cannot audit invalid JSON ${relativePath}: ${error.message}`);
  }
}

const db = getDb();
for (const row of db.prepare("SELECT path, json FROM content_documents ORDER BY path").all()) {
  try {
    walk(JSON.parse(row.json), `content_documents:${row.path}`);
  } catch (error) {
    throw new Error(`Cannot audit invalid DB content ${row.path}: ${error.message}`);
  }
}

const tableImageColumns = [
  ["campaigns", "id", "header_image"],
  ["gazetteer", "id", "image_url"],
  ["organizations", "id", "image"],
];
for (const [table, idColumn, imageColumn] of tableImageColumns) {
  for (const row of db.prepare(`SELECT ${idColumn} AS id, ${imageColumn} AS image FROM ${table}`).all()) {
    inspectImage(row.image, `${table}:${row.id}.${imageColumn}`);
  }
}

if (remote.length || missing.length) {
  if (remote.length) {
    console.error("Remote site image references:");
    remote.forEach((item) => console.error(`  ${item.location}: ${item.value}`));
  }
  if (missing.length) {
    console.error("Missing local site images:");
    missing.forEach((item) => console.error(`  ${item.location}: ${item.value}`));
  }
  process.exitCode = 1;
} else {
  console.log("Local image audit passed: no remote image references or missing local image files.");
}
