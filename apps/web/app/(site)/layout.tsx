import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ParticleField } from "@/components/fantasy/ParticleField";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Fixed ambient particle layer */}
      <ParticleField />

      {/* Navigation */}
      <Navbar />

      {/* Page content */}
      <main className="flex-1 relative z-10">{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
