"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export interface PreviousCampaignFoldCardProps {
  id: string;
  name: string;
  dm: string;
  status: string;
  headerImage?: string;
  headerImagePosition?: string;
  description?: string;
}

const PLACEHOLDER_DESCRIPTIONS = [
  "Completed campaign from the Suwanee Gamers archive.",
  "On-hiatus campaign from the Suwanee Gamers archive.",
];

export function PreviousCampaignFoldCard({
  id,
  name,
  dm,
  status,
  headerImage,
  headerImagePosition,
  description,
}: PreviousCampaignFoldCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDescription =
    Boolean(description?.trim()) &&
    !PLACEHOLDER_DESCRIPTIONS.includes(description?.trim() ?? "");

  return (
    <article
      className="relative overflow-hidden rounded-lg border"
      style={{
        borderColor: "var(--color-bg-border)",
        background: "linear-gradient(135deg, rgba(15,10,26,.82), rgba(8,5,15,.72))",
        boxShadow: "0 14px 38px rgba(0,0,0,.28)",
      }}
    >
      <div className={headerImage ? "grid sm:grid-cols-[13rem_1fr]" : undefined}>
        {headerImage && (
          <Link
            href={`/previous-campaigns/${id}`}
            className="relative block min-h-28 sm:min-h-full"
            aria-label={`${name} campaign page`}
          >
            <Image
              src={headerImage}
              alt={`${name} campaign art`}
              fill
              sizes="(min-width: 640px) 13rem, 100vw"
              className="object-cover"
              style={{ objectPosition: headerImagePosition ?? "center" }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(180deg, rgba(8,5,15,.04), rgba(8,5,15,.34))",
              }}
            />
          </Link>
        )}

        <div
          role={hasDescription ? "button" : undefined}
          tabIndex={hasDescription ? 0 : undefined}
          aria-expanded={hasDescription ? isOpen : undefined}
          onClick={hasDescription ? () => setIsOpen((o) => !o) : undefined}
          onKeyDown={
            hasDescription
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsOpen((o) => !o);
                  }
                }
              : undefined
          }
          className={`flex min-w-0 items-center justify-between gap-4 p-5 ${hasDescription ? "cursor-pointer" : ""}`}
        >
          <div className="min-w-0">
            <p
              className="font-cinzel mb-2 text-xs uppercase tracking-[0.24em]"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              {status} · DM: {dm}
            </p>
            <h3
              className="font-cinzel text-lg leading-snug"
              style={{ color: "var(--color-text-primary)" }}
            >
              <Link
                href={`/previous-campaigns/${id}`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {name}
              </Link>
            </h3>
          </div>

          {hasDescription && (
            <button
              type="button"
              className="shrink-0 transition-colors hover:opacity-80"
              style={{ color: "var(--color-accent-gold)" }}
              onClick={(e) => { e.stopPropagation(); setIsOpen((o) => !o); }}
              title={isOpen ? "Hide description" : "Read campaign description"}
              aria-label={isOpen ? "Hide description" : "Read campaign description"}
              aria-expanded={isOpen}
            >
              <ChevronDown
                className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      {isOpen && hasDescription && (
        <div
          className="border-t px-6 py-5"
          style={{ borderColor: "var(--color-bg-border)" }}
        >
          <p
            className="font-cinzel mb-3 text-xs uppercase tracking-[0.24em]"
            style={{ color: "var(--color-accent-gold)" }}
          >
            About This Campaign
          </p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {description}
          </p>
        </div>
      )}
    </article>
  );
}
