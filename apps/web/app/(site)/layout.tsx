import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ParticleField } from "@/components/fantasy/ParticleField";
import { getNavConfig } from "@/lib/nav";
import { getAdminSession } from "@/lib/adminSession";
import { PageEditOverlay } from "@/components/admin/PageEditOverlay";
import { getActiveCustomPages } from "@/lib/customPages";
import { PAGE_SECTIONS } from "@/lib/pageSections";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navConfig = getNavConfig();

  const session = await getAdminSession();
  const isAdmin = session.isAdmin === true;
  const editMode = isAdmin && session.editMode === true;

  // Paths where the Edit Layout overlay should be available
  const builtInPaths = Object.keys(PAGE_SECTIONS);
  const customPaths = getActiveCustomPages().map((p) => `/${p.slug}`);
  const managedPaths = [...builtInPaths, ...customPaths];

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Fixed ambient particle layer */}
      <ParticleField />

      {/* Navigation */}
      <Navbar
        sections={navConfig.sections}
        isAdmin={isAdmin}
        editMode={editMode}
      />

      {/* Page content */}
      <main className="flex-1 relative z-10 pt-16">{children}</main>

      {/* Footer */}
      <Footer />

      {/* Page layout editor — only rendered when admin is logged in */}
      {editMode && <PageEditOverlay managedPaths={managedPaths} />}
    </div>
  );
}
