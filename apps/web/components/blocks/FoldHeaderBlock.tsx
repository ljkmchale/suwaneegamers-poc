"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function FoldHeaderBlock({
  props,
  dataBlockId,
}: {
  props: Record<string, unknown>;
  dataBlockId?: string;
}) {
  const eyebrow      = props.eyebrow      as string | undefined;
  const title        = (props.title       as string | undefined) ?? "Expandable Header";
  const description  = props.description  as string | undefined;
  const foldLabel    = (props.foldLabel   as string | undefined) ?? "View details";
  const foldText     = props.foldText     as string | undefined;
  const foldImage    = props.foldImage    as string | undefined;
  const foldImageAlt = (props.foldImageAlt as string | undefined) ?? "";
  const foldImageFit = (props.foldImageFit as string | undefined) ?? "cover";
  const defaultOpen  = props.defaultState === "open";
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <section data-block-id={dataBlockId} data-block-type="fold-header" className="max-w-6xl mx-auto px-6 py-6">
      <div className="fantasy-card overflow-hidden">
        <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}
          className="w-full cursor-pointer px-6 py-5 text-left">
          <div className="flex items-center justify-between gap-5">
            <div className="min-w-0">
              {eyebrow && (
                <p className="font-cinzel text-[0.65rem] tracking-[0.35em] uppercase mb-1"
                  style={{ color: "var(--color-accent-arcane)" }}>{eyebrow}</p>
              )}
              <h2 className="font-cinzel text-xl tracking-widest uppercase"
                style={{ color: "var(--color-text-primary)" }}>{title}</h2>
              {description && (
                <p className="mt-2 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}>{description}</p>
              )}
            </div>
            <span className="shrink-0 inline-flex items-center gap-2 text-xs font-cinzel tracking-widest uppercase"
              style={{ color: "var(--color-accent-gold)" }}>
              {foldLabel}
              <span className="text-base" aria-hidden="true">{isOpen ? "-" : "+"}</span>
            </span>
          </div>
        </button>
        {isOpen && (foldText || foldImage) && (
          <div className="border-t px-6 py-5" style={{ borderColor: "var(--color-bg-border)" }}>
            {foldText && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}>{foldText}</p>
            )}
            {foldImage && (
              <div className="relative mt-4 min-h-64 overflow-hidden rounded-md border"
                style={{ borderColor: "var(--color-bg-border)" }}>
                <Image src={foldImage} alt={foldImageAlt} fill
                  className={foldImageFit === "contain" ? "object-contain p-3" : "object-cover"}
                  sizes="(max-width: 768px) 100vw, 75vw" />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
