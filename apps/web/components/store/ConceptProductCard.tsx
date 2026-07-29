"use client";

import Image from "next/image";
import { useState } from "react";

interface ProductVariant {
  label: string;
  color: string;
  image: string;
}

interface ConceptProductCardProps {
  anchorId?: string;
  category: string;
  name: string;
  description: string;
  image: string;
  colors: string[];
  variants?: ProductVariant[];
  priceLabel: string;
  sampleShipping: string;
}

export function ConceptProductCard({
  anchorId,
  category,
  name,
  description,
  image,
  colors,
  variants,
  priceLabel,
  sampleShipping,
}: ConceptProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState(0);
  const selectedImage = variants?.[selectedVariant]?.image ?? image;

  return (
    <article
      id={anchorId}
      className="group scroll-mt-24 overflow-hidden rounded-xl border bg-[#100a19]"
      style={{ borderColor: "var(--color-bg-border)" }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#08050f]">
        <Image
          src={selectedImage}
          alt={variants ? `${name} in ${variants[selectedVariant].label}` : name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-contain transition-all duration-500 group-hover:scale-[1.02]"
        />
        <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[10px] uppercase tracking-[.2em] text-white backdrop-blur-md">
          Concept preview
        </span>
        {variants && (
          <span className="absolute bottom-4 right-4 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[10px] uppercase tracking-[.2em] text-white backdrop-blur-md">
            {variants[selectedVariant].label}
          </span>
        )}
      </div>
      <div className="p-6">
        <p className="text-[10px] uppercase tracking-[.25em]" style={{ color: "var(--color-accent-arcane)" }}>{category}</p>
        <h3 className="mt-2 font-cinzel text-lg uppercase tracking-wider">{name}</h3>
        <p className="mt-3 min-h-12 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{description}</p>
        <div className="mt-4 flex items-end justify-between border-t pt-4" style={{ borderColor: "var(--color-bg-border)" }}>
          <div>
            <p className="text-[10px] uppercase tracking-[.2em]" style={{ color: "var(--color-text-muted)" }}>Sample price</p>
            <p className="mt-1 font-cinzel text-lg" style={{ color: "var(--color-accent-gold)" }}>{priceLabel}</p>
          </div>
          <p className="text-right text-xs" style={{ color: "var(--color-text-muted)" }}>{sampleShipping}<br />or free local pickup</p>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <div className="flex gap-2" aria-label={variants ? `${name} variants` : "Planned colors"}>
            {variants
              ? variants.map((variant, index) => (
                  <button
                    key={variant.label}
                    type="button"
                    title={variant.label}
                    aria-label={`Show ${variant.label}`}
                    aria-pressed={selectedVariant === index}
                    onClick={() => setSelectedVariant(index)}
                    className="h-6 w-6 rounded-full border transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    style={{
                      background: variant.color,
                      borderColor: selectedVariant === index ? "#f5ead4" : "rgba(255,255,255,.2)",
                      boxShadow: selectedVariant === index ? "0 0 0 2px rgba(139,92,246,.6)" : undefined,
                    }}
                  />
                ))
              : colors.map((color) => (
                  <span key={color} className="h-5 w-5 rounded-full border border-white/20" style={{ background: color }} />
                ))}
          </div>
          <span className="font-cinzel text-xs uppercase tracking-wider" style={{ color: "var(--color-accent-gold)" }}>Coming soon</span>
        </div>
      </div>
    </article>
  );
}
