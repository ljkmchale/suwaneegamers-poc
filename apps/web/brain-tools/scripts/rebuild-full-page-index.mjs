import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../src/config.mjs";
import { parseFrontmatter, titleFromMarkdown } from "../src/markdown.mjs";

const wikiRoot = path.join(config.vaultRoot, "wiki");
const outputPath = path.join(wikiRoot, "indexes", "Full Wiki Page Index.md");

const files = (await findMarkdownFiles(wikiRoot))
  .map((filePath) => ({
    filePath,
    relativePath: path.relative(config.vaultRoot, filePath).replaceAll(path.sep, "/")
  }))
  .filter((file) => file.relativePath !== "wiki/indexes/Full Wiki Page Index.md")
  .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

const groups = new Map();
for (const file of files) {
  const raw = await fs.readFile(file.filePath, "utf8");
  const { body } = parseFrontmatter(raw);
  const title = titleFromMarkdown(body, file.filePath);
  const group = groupName(file.relativePath);
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push({ ...file, title });
}

const lines = [
  "# Full Wiki Page Index",
  "",
  "Generated index of wiki pages used by audit and navigation. Regenerate with `npm run rebuild-page-index` from `brain-query/`.",
  ""
];

for (const [group, pages] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  lines.push(`## ${group}`, "");
  for (const page of pages) {
    const target = page.relativePath.replace(/^wiki\//, "").replace(/\.md$/i, "");
    lines.push(`- [[${target}|${page.title}]]`);
  }
  lines.push("");
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${lines.join("\n").trimEnd()}\n`, "utf8");
console.log(`Wrote ${path.relative(config.vaultRoot, outputPath).replaceAll(path.sep, "/")} with ${files.length} pages.`);

async function findMarkdownFiles(root) {
  const results = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith(".md")) results.push(fullPath);
    }
  }
  await walk(root);
  return results;
}

function groupName(relativePath) {
  const parts = relativePath.split("/");
  if (parts.length < 3) return "Root";
  return parts.slice(1, Math.min(parts.length - 1, 3)).map(titleCase).join(" / ");
}

function titleCase(value) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
