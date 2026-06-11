"use client";

import { useState } from "react";
import Image from "next/image";
import type { Territory } from "@/lib/territories";

interface RegionGroup {
  region: string;
  territories: Territory[];
}

function TerritoryCard({ territory }: { territory: Territory }) {
  return (
    <article
      className="relative grid overflow-hidden rounded-lg border sm:grid-cols-[13rem_1fr]"
      style={{
        borderColor: "var(--color-bg-border)",
        background:
          "linear-gradient(135deg, rgba(15,10,26,.82), rgba(8,5,15,.72))",
        boxShadow: "0 14px 38px rgba(0,0,0,.28)",
      }}
    >
      <div className="relative flex min-h-28 items-center justify-center p-4 sm:min-h-full">
        {territory.image && (
          <Image
            src={territory.image}
            alt={`${territory.name} territory silhouette`}
            width={180}
            height={180}
            className="max-h-36 w-auto object-contain"
            style={{
              filter: "drop-shadow(0 0 14px rgba(139,92,246,.28))",
            }}
          />
        )}
      </div>

      <div className="flex min-w-0 items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p
            className="font-cinzel mb-2 text-xs uppercase tracking-[0.24em]"
            style={{ color: "var(--color-accent-arcane)" }}
          >
            {territory.capital ? <>Capital: {territory.capital}</> : <>No established capital</>}
          </p>
          <h3
            className="font-cinzel text-lg leading-snug"
            style={{ color: "var(--color-text-primary)" }}
          >
            {territory.name}
          </h3>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {territory.description}
          </p>
        </div>

        {territory.href && (
          <div className="flex shrink-0 items-center">
            <a
              href={territory.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`Read the full ${territory.name} entry`}
              aria-label={`Read the full ${territory.name} entry`}
              className="transition-colors hover:opacity-80"
              style={{ color: "var(--color-text-muted)" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

function RegionFold({ group }: { group: RegionGroup }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="py-2">
      <div className="fantasy-card overflow-hidden">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="w-full cursor-pointer px-6 py-5 text-left"
        >
          <div className="flex items-center justify-between gap-5">
            <div className="min-w-0">
              <p
                className="font-cinzel mb-1 text-[0.65rem] uppercase tracking-[0.35em]"
                style={{ color: "var(--color-accent-arcane)" }}
              >
                Region
              </p>
              <h2
                className="font-cinzel text-xl uppercase tracking-widest"
                style={{ color: "var(--color-text-primary)" }}
              >
                {group.region}
              </h2>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {group.territories.length}{" "}
                {group.territories.length === 1 ? "territory" : "territories"}
              </p>
            </div>
            <span
              className="font-cinzel inline-flex shrink-0 items-center gap-2 text-xs uppercase tracking-widest"
              style={{ color: "var(--color-accent-gold)" }}
            >
              Open Territories
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
            <div className="grid gap-4">
              {group.territories.map((territory) => (
                <TerritoryCard key={territory.id} territory={territory} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function TerritoryFolds({ groups }: { groups: RegionGroup[] }) {
  return (
    <div>
      {groups.map((group) => (
        <RegionFold key={group.region} group={group} />
      ))}
    </div>
  );
}
