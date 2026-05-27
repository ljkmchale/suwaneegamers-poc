import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ParticleField } from "@/components/fantasy/ParticleField";
import { getNavConfig, getNavSection } from "@/lib/nav";
import { getAdminSession } from "@/lib/adminSession";
import { PageEditOverlay } from "@/components/admin/PageEditOverlay";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navConfig = getNavConfig();
  const primaryNav = getNavSection(navConfig, "primary");
  const worldNav = getNavSection(navConfig, "world");
  const toolsNav = getNavSection(navConfig, "tools");

  const session = await getAdminSession();
  const isAdmin = session.isAdmin === true;

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

      {/* Page layout editor — only rendered when admin is logged in */}
      {isAdmin && <PageEditOverlay />}
    </div>
  );
}
