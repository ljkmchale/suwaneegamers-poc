"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  isDeceased,
  rosterDescriptor,
  rosterStatusLabel,
  type RosterCharacter,
} from "@/lib/campaignRoster";

export interface PreviousCampaignFoldCardProps {
  id: string;
  name: string;
  dm: string;
  status: string;
  headerImage?: string;
  headerImagePosition?: string;
  description?: string;
  roster?: RosterCharacter[];
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
  roster,
}: PreviousCampaignFoldCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDescription =
    Boolean(description?.trim()) &&
    !PLACEHOLDER_DESCRIPTIONS.includes(description?.trim() ?? "");
  const hasRoster = Boolean(roster?.length);
  const hasFold = hasDescription || hasRoster;

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
          role={hasFold ? "button" : undefined}
          tabIndex={hasFold ? 0 : undefined}
          aria-expanded={hasFold ? isOpen : undefined}
          onClick={hasFold ? () => setIsOpen((o) => !o) : undefined}
          onKeyDown={
            hasFold
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsOpen((o) => !o);
                  }
                }
              : undefined
          }
          className={`flex min-w-0 items-center justify-between gap-4 p-5 ${hasFold ? "cursor-pointer" : ""}`}
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

          {hasFold && (
            <button
              type="button"
              className="shrink-0 transition-colors hover:opacity-80"
              style={{ color: "var(--color-accent-gold)" }}
              onClick={(e) => { e.stopPropagation(); setIsOpen((o) => !o); }}
              title={isOpen ? "Hide details" : "View campaign details"}
              aria-label={isOpen ? "Hide details" : "View campaign details"}
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

      {isOpen && hasFold && (
        <div
          className="border-t px-6 py-5"
          style={{ borderColor: "var(--color-bg-border)" }}
        >
          {hasDescription && (
            <>
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
            </>
          )}

          {hasRoster && (
            <div className={hasDescription ? "mt-6" : undefined}>
              <p
                className="font-cinzel mb-3 text-xs uppercase tracking-[0.24em]"
                style={{ color: "var(--color-accent-gold)" }}
              >
                The Party
              </p>
              <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {roster!.map((c) => {
                  const descriptor = rosterDescriptor(c);
                  const statusLabel = rosterStatusLabel(c);
                  const deceased = isDeceased(c);
                  return (
                    <li
                      key={c.character}
                      className="rounded-md border px-3 py-2"
                      style={{
                        borderColor: "var(--color-bg-border)",
                        background: "rgba(8, 5, 15, 0.35)",
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="text-sm font-medium"
                          style={{
                            color: deceased
                              ? "var(--color-text-muted)"
                              : "var(--color-text-primary)",
                          }}
                        >
                          {deceased && (
                            <span aria-hidden="true" className="mr-1.5">
                              ☠
                            </span>
                          )}
                          {c.character}
                        </span>
                        {statusLabel && (
                          <span
                            className="shrink-0 text-[11px] font-cinzel uppercase tracking-wider"
                            style={{
                              color: deceased
                                ? "var(--color-accent-blood)"
                                : "var(--color-accent-arcane)",
                            }}
                          >
                            {statusLabel}
                          </span>
                        )}
                      </div>
                      {(c.player || descriptor) && (
                        <p
                          className="mt-0.5 text-xs leading-relaxed"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          {[c.player, descriptor].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {c.notes && (
                        <p
                          className="mt-0.5 text-xs italic"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {c.notes}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
