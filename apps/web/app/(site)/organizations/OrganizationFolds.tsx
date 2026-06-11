"use client";

import { useState } from "react";
import Image from "next/image";
import type { Organization } from "@/lib/organizations";

interface OrganizationGroup {
  label: string;
  organizations: Organization[];
}

// ── Detail text renderer ───────────────────────────────────────────────────────
// The synced doc details use a light line format: blank-line paragraphs,
// "• " bullets, ALL-CAPS subheadings, and indented "a | b | c" table rows
// (first row is the header). Render each as proper elements.

type DetailSegment =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "table"; rows: string[][] };

function parseDetails(details: string): DetailSegment[] {
  const segments: DetailSegment[] = [];
  const lines = details.split("\n");
  let i = 0;

  const isTableRow = (line: string) => /^\s{2,}.*\|/.test(line);
  const isBullet = (line: string) => line.trimStart().startsWith("• ");
  const isHeading = (line: string) => {
    const t = line.trim();
    return t.length > 0 && t.length < 60 && /[A-Z]/.test(t) && t === t.toUpperCase();
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (isTableRow(line)) {
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(lines[i].split("|").map((c) => c.trim()).filter(Boolean));
        i++;
      }
      segments.push({ kind: "table", rows });
      continue;
    }

    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].trimStart().slice(2).trim());
        i++;
      }
      segments.push({ kind: "bullets", items });
      continue;
    }

    if (isHeading(line)) {
      segments.push({ kind: "heading", text: line.trim() });
      i++;
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length && lines[i].trim() &&
      !isTableRow(lines[i]) && !isBullet(lines[i]) && !isHeading(lines[i])
    ) {
      paragraph.push(lines[i].trim());
      i++;
    }
    segments.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return segments;
}

function DetailTable({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <div
      className="my-4 max-w-md overflow-x-auto rounded-lg border"
      style={{ borderColor: "var(--color-bg-border)" }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "rgba(245,158,11,.08)" }}>
            {header.map((cell, i) => (
              <th
                key={i}
                className="font-cinzel px-4 py-2.5 text-left text-xs uppercase tracking-[0.2em]"
                style={{
                  color: "var(--color-accent-gold)",
                  borderBottom: "1px solid var(--color-bg-border)",
                }}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((cells, r) => (
            <tr
              key={r}
              style={r < body.length - 1 ? { borderBottom: "1px solid var(--color-bg-border)" } : undefined}
            >
              {cells.map((cell, c) => (
                <td
                  key={c}
                  className="px-4 py-2 align-top"
                  style={{
                    color: c === 0 ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrganizationDetails({ details }: { details: string }) {
  const segments = parseDetails(details);
  return (
    <div className="space-y-4">
      {segments.map((segment, i) => {
        if (segment.kind === "heading") {
          return (
            <h3
              key={i}
              className="font-cinzel pt-2 text-sm uppercase tracking-[0.24em]"
              style={{ color: "var(--color-accent-gold)" }}
            >
              {segment.text}
            </h3>
          );
        }
        if (segment.kind === "bullets") {
          return (
            <ul key={i} className="space-y-1.5 pl-1">
              {segment.items.map((item, j) => (
                <li
                  key={j}
                  className="flex gap-2 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <span style={{ color: "var(--color-accent-arcane)" }} aria-hidden="true">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (segment.kind === "table") {
          return <DetailTable key={i} rows={segment.rows} />;
        }
        return (
          <p
            key={i}
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {segment.text}
          </p>
        );
      })}
    </div>
  );
}

function OrganizationFold({ organization }: { organization: Organization }) {
  const [isOpen, setIsOpen] = useState(false);

  const fallbackBody =
    organization.description ??
    organization.summary ??
    "Listed among the well-known organizations of Myrdae.";

  return (
    <section className="py-2">
      <div className="fantasy-card overflow-hidden">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="grid w-full cursor-pointer overflow-hidden text-left sm:grid-cols-[13rem_1fr]"
        >
          <div className="relative flex min-h-24 items-center justify-center p-4 sm:min-h-full">
            {organization.image && (
              <Image
                src={organization.image}
                alt={`${organization.name} symbol`}
                width={160}
                height={160}
                className="max-h-28 w-auto object-contain"
                style={{
                  filter: "drop-shadow(0 0 14px rgba(139,92,246,.28))",
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-5 px-6 py-5">
            <div className="min-w-0">
              <p
                className="font-cinzel mb-1 text-[0.65rem] uppercase tracking-[0.35em]"
                style={{ color: "var(--color-accent-arcane)" }}
              >
                {organization.knownFor ?? "Organization"}
              </p>
              <h2
                className="font-cinzel text-xl uppercase tracking-widest"
                style={{ color: "var(--color-text-primary)" }}
              >
                {organization.name}
              </h2>
              {organization.summary && (
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {organization.summary}
                </p>
              )}
            </div>
            <span
              className="font-cinzel inline-flex shrink-0 items-center gap-2 text-xs uppercase tracking-widest"
              style={{ color: "var(--color-accent-gold)" }}
            >
              Open Details
              <span className="text-base" aria-hidden="true">
                {isOpen ? "-" : "+"}
              </span>
            </span>
          </div>
        </button>

        {isOpen && (
          <div
            className="border-t px-6 py-5"
            style={{ borderColor: "var(--color-bg-border)" }}
          >
            {organization.details ? (
              <OrganizationDetails details={organization.details} />
            ) : (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {fallbackBody}
              </p>
            )}

            {organization.href && (
              <a
                href={organization.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-cinzel mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-widest transition-colors hover:opacity-80"
                style={{ color: "var(--color-accent-gold)" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Open Full Entry
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function OrganizationFolds({ groups }: { groups: OrganizationGroup[] }) {
  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.label}>
          <div className="mb-5">
            <p
              className="font-cinzel text-xs uppercase tracking-[0.35em]"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              Organizations
            </p>
            <h2
              className="font-cinzel mt-1 text-2xl"
              style={{ color: "var(--color-accent-gold)" }}
            >
              {group.label}
            </h2>
          </div>
          {group.organizations.map((organization) => (
            <OrganizationFold key={organization.id} organization={organization} />
          ))}
        </section>
      ))}
    </div>
  );
}
