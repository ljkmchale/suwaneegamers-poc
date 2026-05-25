import Link from "next/link";
import type { PortalLink } from "@/lib/portal";

interface PortalPageProps {
  eyebrow?: string;
  title: string;
  description: string;
  links: PortalLink[];
}

function isExternal(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function PortalPage({ eyebrow = "Portal", title, description, links }: PortalPageProps) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <header className="mb-14 text-center">
        <p
          className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3"
          style={{ color: "var(--color-accent-arcane)" }}
        >
          {eyebrow}
        </p>
        <h1 className="font-cinzel text-4xl tracking-widest uppercase mb-4 shimmer-text">
          {title}
        </h1>
        <p className="max-w-2xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
          {description}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {links.map((link) => {
          const external = isExternal(link.href);
          const className = "fantasy-card p-6 block group";
          const content = (
            <>
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2
                  className="font-cinzel text-xl leading-tight group-hover:opacity-80 transition-opacity"
                  style={{ color: "var(--color-accent-gold)" }}
                >
                  {link.title}
                </h2>
                <span
                  className="text-xs font-cinzel tracking-widest uppercase"
                  style={{ color: "var(--color-accent-arcane)" }}
                >
                  {external ? "↗" : "→"}
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--color-text-secondary)" }}>
                {link.description}
              </p>
              <span
                className="text-xs font-cinzel tracking-widest uppercase"
                style={{ color: "var(--color-text-muted)" }}
              >
                {link.label ?? (external ? "Open" : "View")}
              </span>
            </>
          );

          if (external) {
            return (
              <a key={link.title} href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
                {content}
              </a>
            );
          }

          return (
            <Link key={link.title} href={link.href} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
