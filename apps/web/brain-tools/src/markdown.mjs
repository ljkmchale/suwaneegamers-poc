import path from "node:path";

export function parseFrontmatter(markdown) {
  const open = markdown.match(/^---\r?\n/);
  if (!open) {
    return { frontmatter: {}, body: markdown };
  }

  const close = markdown.indexOf("\n---", open[0].length);
  if (close === -1) return { frontmatter: {}, body: markdown };

  const raw = markdown.slice(open[0].length, close).trim();
  const body = markdown.slice(close + 4).replace(/^\r?\n/, "");
  const frontmatter = {};

  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    frontmatter[key] = parseFrontmatterValue(value);
  }

  return { frontmatter, body };
}

function parseFrontmatterValue(value) {
  const cleaned = value.trim().replace(/^["']|["']$/g, "");
  if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
    return cleaned.slice(1, -1).split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  if (cleaned === "true") return true;
  if (cleaned === "false") return false;
  return cleaned;
}

export function titleFromMarkdown(markdown, filePath) {
  const heading = markdown.match(/^#\s+(.+)$/m);
  if (heading) return cleanInlineMarkdown(heading[1]);
  return path.basename(filePath, ".md");
}

export function splitMarkdownByHeading(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = { heading: "Overview", text: [] };

  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading && current.text.join("\n").trim()) {
      sections.push({ heading: current.heading, text: current.text.join("\n").trim() });
      current = { heading: cleanInlineMarkdown(heading[2]), text: [line] };
    } else if (heading) {
      current.heading = cleanInlineMarkdown(heading[2]);
      current.text.push(line);
    } else {
      current.text.push(line);
    }
  }

  if (current.text.join("\n").trim()) {
    sections.push({ heading: current.heading, text: current.text.join("\n").trim() });
  }

  return sections;
}

export function cleanMarkdown(markdown) {
  return markdown
    .replace(/!\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractWikiLinks(markdown) {
  const links = new Set();
  const pattern = /!?\[\[([^\]]+)\]\]/g;
  let match;

  while ((match = pattern.exec(markdown)) !== null) {
    const target = match[1]
      .split("|")[0]
      .split("#")[0]
      .trim();
    if (target) links.add(target);
  }

  return [...links];
}

function cleanInlineMarkdown(text) {
  return text.replace(/[#*_`[\]]/g, "").trim();
}
