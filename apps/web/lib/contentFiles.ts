import fs from "fs";
import path from "path";

export function contentPath(filename: string) {
  return path.join(process.cwd(), "../../content", filename);
}

export function readContent<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(contentPath(filename), "utf-8")) as T;
}

export function writeContent(filename: string, data: unknown): void {
  fs.writeFileSync(contentPath(filename), JSON.stringify(data, null, 2) + "\n", "utf-8");
}
