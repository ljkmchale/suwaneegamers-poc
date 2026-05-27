import Link from "next/link";
import Image from "next/image";
import { HeroSection } from "@/components/fantasy/HeroSection";
import { ScrollReveal } from "@/components/fantasy/ScrollReveal";
import { getPortalLinks } from "@/lib/portal";
import { getPageLayout } from "@/lib/pageLayouts";

// ── Sections ──────────────────────────────────────────────────────────────────

function HeroBlock() {
  return <HeroSection />;
}

function PortalBlock({ portalLinks }: { portalLinks: ReturnType<typeof getPortalLinks> }) {
  return (
    <ScrollReveal>
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col lg:flex-row gap-12 items-start">

          {/* Campaign Portal — left/main */}
          <div className="flex-1">
            <p
              className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              Suwanee Gamers
            </p>
            <h2 className="font-cinzel text-2xl tracking-widest uppercase mb-4 shimmer-text">
              Campaign Portal
            </h2>
            <p className="max-w-2xl mb-10" style={{ color: "var(--color-text-secondary)" }}>
              This site is the doorway. The Knowledge Base owns the campaign and Myrdae information;
              this portal gets players and DMs to the live tools, calendars, maps, and references.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {portalLinks.map((link) => {
                const external = link.href.startsWith("http");
                const content = (
                  <>
                    <h3 className="font-cinzel text-base mb-3" style={{ color: "var(--color-accent-gold)" }}>
                      {link.title}
                    </h3>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--color-text-secondary)" }}>
                      {link.description}
                    </p>
                    <span className="text-xs font-cinzel tracking-widest uppercase" style={{ color: "var(--color-text-muted)" }}>
                      {link.label} {external ? "↗" : "→"}
                    </span>
                  </>
                );

                return external ? (
                  <a key={link.title} href={link.href} target="_blank" rel="noopener noreferrer" className="fantasy-card p-5 block group">
                    {content}
                  </a>
                ) : (
                  <Link key={link.title} href={link.href} className="fantasy-card p-5 block group">
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Founders — right sidebar */}
          <div className="lg:w-72 shrink-0">
            <div className="fantasy-card p-6 text-center">
              <p className="font-cinzel text-xs tracking-[0.35em] uppercase mb-5"
                style={{ color: "var(--color-text-muted)" }}>
                Founded By
              </p>

              <div className="space-y-6">
                {[
                  { name: "Chip Poole", role: "Co-Founder", img: "/images/chip-poole.png" },
                  { name: "Sean Poole", role: "Co-Founder", img: "/images/sean-poole.png" },
                ].map((founder) => (
                  <div key={founder.name} className="flex flex-col items-center gap-2">
                    <Image
                      src={founder.img}
                      alt={founder.name}
                      width={80}
                      height={80}
                      className="w-20 h-20 rounded-full object-cover object-top"
                      style={{ border: "2px solid var(--color-accent-gold)" }}
                    />
                    <p className="font-cinzel text-base" style={{ color: "var(--color-accent-gold)" }}>
                      {founder.name}
                    </p>
                    <p className="text-xs tracking-widest uppercase" style={{ color: "var(--color-text-muted)" }}>
                      {founder.role}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--color-bg-border)" }}>
                <p className="text-xs leading-relaxed italic" style={{ color: "var(--color-text-muted)" }}>
                  Chip and his son Sean brought Suwanee Gamers to life, building the community and
                  the world of Myrdae from the ground up.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>
    </ScrollReveal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const portalLinks = getPortalLinks();
  const order = getPageLayout("/");

  const sectionMap: Record<string, React.ReactNode> = {
    hero:   <HeroBlock key="hero" />,
    portal: <PortalBlock key="portal" portalLinks={portalLinks} />,
  };

  return <>{order.map((id) => sectionMap[id] ?? null)}</>;
}
