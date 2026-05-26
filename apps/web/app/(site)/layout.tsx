import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ParticleField } from "@/components/fantasy/ParticleField";
import { getNavConfig, getNavSection } from "@/lib/nav";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navConfig = getNavConfig();
  const primaryNav = getNavSection(navConfig, "primary");
  const worldNav = getNavSection(navConfig, "world");
  const toolsNav = getNavSection(navConfig, "tools");

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Fixed ambient particle layer */}
      <ParticleField />

      {/* Navigation */}
      <Navbar primaryNav={primaryNav} worldNav={worldNav} toolsNav={toolsNav} />

      {/* Page content */}
      <main className="flex-1 relative z-10">{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
