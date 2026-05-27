import Image from "next/image";
import Link from "next/link";
import type { BlockItem } from "@/lib/pageBlocks";

// ── Individual block renderers ────────────────────────────────────────────────

function DividerBlock({ props }: { props: Record<string, unknown> }) {
  const label   = props.label   as string | undefined;
  const variant = (props.variant as string | undefined) ?? "ornate";

  if (label) {
    return (
      <div className="flex items-center gap-4 py-8 max-w-6xl mx-auto px-6">
        <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
        <span className="font-cinzel text-xs tracking-[0.35em] uppercase shrink-0"
          style={{ color: "var(--color-text-muted)" }}>
          {label}
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
      </div>
    );
  }

  if (variant === "ornate") {
    return (
      <div className="py-6 max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
          <span style={{ color: "var(--color-bg-border)", fontSize: "0.7rem" }}>✦</span>
          <div className="flex-1 h-px" style={{ background: "var(--color-bg-border)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 max-w-6xl mx-auto px-6">
      <hr style={{ borderColor: "var(--color-bg-border)" }} />
    </div>
  );
}

function CardBlock({ props }: { props: Record<string, unknown> }) {
  const eyebrow     = props.eyebrow     as string | undefined;
  const title       = props.title       as string;
  const description = props.description as string | undefined;
  const href        = props.href        as string | undefined;
  const linkLabel   = props.linkLabel   as string | undefined;

  const inner = (
    <div className="fantasy-card p-6">
      {eyebrow && (
        <p className="font-cinzel text-xs tracking-[0.35em] uppercase mb-2"
          style={{ color: "var(--color-accent-arcane)" }}>
          {eyebrow}
        </p>
      )}
      <h3 className="font-cinzel text-xl tracking-wider" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </h3>
      {description && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          {description}
        </p>
      )}
      {href && linkLabel && (
        <p className="mt-4 text-xs font-cinzel tracking-widest uppercase"
          style={{ color: "var(--color-accent-gold)" }}>
          {linkLabel} →
        </p>
      )}
    </div>
  );

  if (href) {
    const external = href.startsWith("http://") || href.startsWith("https://");
    return (
      <div className="max-w-6xl mx-auto px-6 py-4">
        {external
          ? <a href={href} target="_blank" rel="noopener noreferrer" className="block group">{inner}</a>
          : <Link href={href} className="block group">{inner}</Link>
        }
      </div>
    );
  }

  return <div className="max-w-6xl mx-auto px-6 py-4">{inner}</div>;
}

function ImageBlock({ props }: { props: Record<string, unknown> }) {
  const src     = props.src     as string;
  const alt     = (props.alt     as string | undefined) ?? "";
  const caption = props.caption as string | undefined;
  const size    = (props.size   as string | undefined) ?? "large";

  if (!src) return null;

  const wrapClass =
    size === "full"   ? "w-full px-0" :
    size === "medium" ? "max-w-xl mx-auto px-6" :
                        "max-w-3xl mx-auto px-6";

  return (
    <div className={`${wrapClass} py-6`}>
      <div className="relative w-full aspect-video rounded-lg overflow-hidden border"
        style={{ borderColor: "var(--color-bg-border)" }}>
        <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 75vw" />
      </div>
      {caption && (
        <p className="mt-3 text-xs text-center font-cinzel tracking-wider"
          style={{ color: "var(--color-text-muted)" }}>
          {caption}
        </p>
      )}
    </div>
  );
}

function TextBlock({ props }: { props: Record<string, unknown> }) {
  const content = props.content as string;
  const align   = (props.align as string | undefined) ?? "left";

  return (
    <div className={`max-w-3xl mx-auto px-6 py-6 ${align === "center" ? "text-center" : ""}`}>
      <p className="text-base leading-relaxed whitespace-pre-wrap"
        style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-body)" }}>
        {content}
      </p>
    </div>
  );
}

function CalloutBlock({ props }: { props: Record<string, unknown> }) {
  const title   = props.title   as string | undefined;
  const content = props.content as string;
  const variant = (props.variant as string | undefined) ?? "gold";

  const colorVar =
    variant === "arcane" ? "var(--color-accent-arcane)" :
    variant === "blood"  ? "var(--color-accent-blood)"  :
                           "var(--color-accent-gold)";

  return (
    <div className="max-w-3xl mx-auto px-6 py-4">
      <div className="rounded-lg border-l-4 p-5"
        style={{ borderColor: colorVar, background: "var(--color-bg-card)" }}>
        {title && (
          <p className="font-cinzel text-sm tracking-widest uppercase mb-2" style={{ color: colorVar }}>
            {title}
          </p>
        )}
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          {content}
        </p>
      </div>
    </div>
  );
}

function SpacerBlock({ props }: { props: Record<string, unknown> }) {
  const size = (props.size as string | undefined) ?? "md";
  const h = size === "sm" ? "h-8" : size === "lg" ? "h-24" : "h-16";
  return <div className={h} aria-hidden="true" />;
}

// ── Public export ─────────────────────────────────────────────────────────────

export function BlockRenderer({ block }: { block: BlockItem }) {
  switch (block.type) {
    case "divider":  return <DividerBlock  props={block.props} />;
    case "card":     return <CardBlock     props={block.props} />;
    case "image":    return <ImageBlock    props={block.props} />;
    case "text":     return <TextBlock     props={block.props} />;
    case "callout":  return <CalloutBlock  props={block.props} />;
    case "spacer":   return <SpacerBlock   props={block.props} />;
    default:         return null;
  }
}
