import fs from "fs";
import path from "path";

export function contentDir() {
  const candidates = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), "content"),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "../../content"),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "content");
}

export function contentPath(filename: string) {
  return path.join(contentDir(), filename);
}

export function readContent<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(contentPath(filename), "utf-8")) as T;
}

export function writeContent(filename: string, data: unknown): void {
  fs.writeFileSync(contentPath(filename), JSON.stringify(data, null, 2) + "\n", "utf-8");
}
