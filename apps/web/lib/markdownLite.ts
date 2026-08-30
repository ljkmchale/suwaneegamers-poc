// Minimal, dependency-free Markdown -> HTML renderer for gazetteer doc bodies.
//
// The gazetteer detail pages render the doc's Markdown export (headings, lists,
// prose, and GFM pipe tables). This renders that subset safely: all text is
// HTML-escaped first, then a small set of block and inline rules apply. It is
// intentionally NOT a full CommonMark/GFM implementation. Output is used with
// dangerouslySetInnerHTML, so escaping is the load-bearing safety property.

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Inline: escape, then apply code / images(strip) / links / bold / italic.
function renderInline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  // Drop images entirely (heraldry is shown separately; doc images are noise here).
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  // Links [label](http...) - only http(s).
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    const safeUrl = url.replace(/"/g, "%22");
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, b) => `<strong>${b}</strong>`);
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, (_m, pre, i) => `${pre}<em>${i}</em>`);
  return out;
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

type ListKind = "ul" | "ol";

export function renderMarkdownLite(markdown: string): string {
  let src = markdown.replace(/^﻿/, "");
  src = src.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
  src = src.replace(/^Pulled:.*(?:\r?\n)+/i, "");

  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];

  let paragraph: string[] = [];
  let list: { kind: ListKind; items: string[] } | null = null;
  let pre: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) { html.push(`<p>${renderInline(paragraph.join(" "))}</p>`); paragraph = []; }
  };
  const flushList = () => {
    if (list) {
      const tag = list.kind;
      html.push(`<${tag}>${list.items.map((i) => `<li>${renderInline(i)}</li>`).join("")}</${tag}>`);
      list = null;
    }
  };
  const flushPre = () => {
    if (pre.length) { html.push(`<pre>${escapeHtml(pre.join("\n"))}</pre>`); pre = []; }
  };
  const flushAll = () => { flushParagraph(); flushList(); flushPre(); };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\s+$/, "");

    if (line.trim() === "") { flushAll(); continue; }

    // GFM pipe table: a "| ... |" row immediately followed by a separator row.
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushAll();
      const header = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|?\s*$/.test(lines[i]) && lines[i].includes("|") && lines[i].trim() !== "") {
        if (isTableSeparator(lines[i])) { i += 1; continue; }
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      i -= 1; // for-loop will increment
      const thead = `<thead><tr>${header.map((c) => `<th>${renderInline(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      html.push(`<div class="gaz-table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    // Tab / deep-indent lines: preserve as preformatted (flattened tables in txt exports).
    if (/^(\t| {4,})/.test(rawLine)) {
      flushParagraph(); flushList();
      pre.push(rawLine.replace(/\t/g, "    "));
      continue;
    } else if (pre.length) {
      flushPre();
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { flushAll(); html.push("<hr />"); continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length + 1, 6);
      const text = heading[2].replace(/\*+/g, "").replace(/^#+\s*/, "").trim();
      html.push(`<h${level}>${renderInline(text)}</h${level}>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushParagraph(); flushList();
      html.push(`<blockquote>${renderInline(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }

    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      flushParagraph();
      if (!list || list.kind !== "ol") { flushList(); list = { kind: "ol", items: [] }; }
      list.items.push(ol[1]);
      continue;
    }

    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      flushParagraph();
      if (!list || list.kind !== "ul") { flushList(); list = { kind: "ul", items: [] }; }
      list.items.push(ul[1]);
      continue;
    }

    // A lone table separator with no header: ignore.
    if (isTableSeparator(line)) { continue; }

    flushList();
    paragraph.push(line.trim());
  }

  flushAll();
  return html.join("\n");
}
