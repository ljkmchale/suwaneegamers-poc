"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SessionRecordingPlayer } from "./SessionRecordingPlayer";
import { recordUsageEvent } from "@/components/analytics/AnalyticsTracker";

export interface AdventureFoldCardProps {
  campaignId: string;
  campaignName: string;
  headerImage?: string;
  headerImagePosition?: string;
  dateLabel?: string;
  nextDateLabel?: string;
  nextTimeLabel?: string;
  isToday?: boolean;
  sessionNumber?: number;
  sessionTitle: string;
  summary?: string;
  audioUrl?: string;
}

export function AdventureFoldCard({
  campaignId,
  campaignName,
  headerImage,
  headerImagePosition,
  dateLabel,
  nextDateLabel,
  nextTimeLabel,
  isToday = false,
  sessionNumber,
  sessionTitle,
  summary,
  audioUrl,
}: AdventureFoldCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasSummary = Boolean(summary?.trim());

  const paragraphs = (summary ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

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
            href={`/campaigns/${campaignId}`}
            className="relative block min-h-28 sm:min-h-full"
            aria-label={`${campaignName} campaign page`}
          >
            <Image
              src={headerImage}
              alt={`${campaignName} campaign art`}
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
          role={hasSummary ? "button" : undefined}
          tabIndex={hasSummary ? 0 : undefined}
          aria-expanded={hasSummary ? isOpen : undefined}
          onClick={hasSummary ? () => {
            setIsOpen((open) => {
              if (!open) {
                recordUsageEvent({
                  eventType: "content_open",
                  contentType: "session summary",
                  contentId: `${campaignId}:${sessionNumber ?? sessionTitle}`,
                  contentLabel: `${campaignName} - ${sessionTitle}`,
                });
              }
              return !open;
            });
          } : undefined}
          onKeyDown={
            hasSummary
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setIsOpen((open) => {
                      if (!open) {
                        recordUsageEvent({
                          eventType: "content_open",
                          contentType: "session summary",
                          contentId: `${campaignId}:${sessionNumber ?? sessionTitle}`,
                          contentLabel: `${campaignName} - ${sessionTitle}`,
                        });
                      }
                      return !open;
                    });
                  }
                }
              : undefined
          }
          className={`flex min-w-0 items-center justify-between gap-4 p-5 ${hasSummary ? "cursor-pointer" : ""}`}
        >
          <div className="min-w-0">
            <h3
              className="font-cinzel mb-2 text-lg leading-snug"
              style={{ color: "var(--color-text-primary)" }}
            >
              <Link
                href={`/campaigns/${campaignId}`}
                className="hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {campaignName}
              </Link>
            </h3>
            {nextDateLabel && (
              <p className="text-sm leading-relaxed">
                <span
                  className="font-cinzel mr-3 uppercase"
                  style={{ color: "var(--color-accent-gold)" }}
                >
                  Next session
                </span>
                <span style={{ color: "var(--color-accent-arcane)" }}>
                  {nextDateLabel}{nextTimeLabel ? ` - ${nextTimeLabel}` : ""}
                </span>
              </p>
            )}
            {dateLabel && (
              <p className="text-sm leading-relaxed">
                <span
                  className="font-cinzel mr-3 uppercase"
                  style={{ color: "var(--color-accent-gold)" }}
                >
                  Prior session
                </span>
                <span style={{ color: "var(--color-accent-arcane)" }}>
                  {dateLabel} -{" "}
                  {sessionNumber !== undefined && <>Session {sessionNumber} - </>}
                  {sessionTitle}
                </span>
              </p>
            )}
          </div>

          <div
            className="flex shrink-0 items-center gap-3 self-start sm:self-center"
            onClick={(event) => event.stopPropagation()}
          >
            {isToday && (
              <span
                className="rounded-full border px-3 py-1 font-cinzel text-[0.65rem] uppercase tracking-[0.2em]"
                style={{
                  background: "rgba(245,158,11,.18)",
                  borderColor: "rgba(245,158,11,.55)",
                  color: "var(--color-accent-gold)",
                  boxShadow: "0 0 18px rgba(245,158,11,.22)",
                }}
              >
                Today
              </span>
            )}
            {audioUrl && (
              <SessionRecordingPlayer
                url={audioUrl}
                label={`${campaignName} - ${sessionTitle}`}
              />
            )}
            {hasSummary && (
              <button
                type="button"
                onClick={() => setIsOpen((open) => {
                  if (!open) {
                    recordUsageEvent({
                      eventType: "content_open",
                      contentType: "session summary",
                      contentId: `${campaignId}:${sessionNumber ?? sessionTitle}`,
                      contentLabel: `${campaignName} - ${sessionTitle}`,
                    });
                  }
                  return !open;
                })}
                title={isOpen ? "Hide session summary" : "Read the session summary"}
                aria-label={isOpen ? "Hide session summary" : "Read the session summary"}
                aria-expanded={isOpen}
                className="transition-colors hover:opacity-80"
                style={{ color: "var(--color-accent-gold)" }}
              >
                <ChevronDown
                  className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {isOpen && hasSummary && (
        <div
          className="border-t px-6 py-5"
          style={{ borderColor: "var(--color-bg-border)" }}
        >
          <p
            className="font-cinzel mb-3 text-xs uppercase tracking-[0.24em]"
            style={{ color: "var(--color-accent-gold)" }}
          >
            Session Summary
          </p>
          <div className="space-y-3">
            {paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
