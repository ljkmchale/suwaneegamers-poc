export const dynamic = "force-dynamic";

import { Navbar } from "@/components/layout/Navbar";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { ParticleField } from "@/components/fantasy/ParticleField";
import { getNavConfig } from "@/lib/nav";
import { getAdminSession } from "@/lib/adminSession";
import { PageEditOverlay } from "@/components/admin/PageEditOverlay";
import { getActiveCustomPages } from "@/lib/customPages";
import { getManagedCampaignDetailPaths } from "@/lib/campaignDetailLayouts";
import { PAGE_SECTIONS } from "@/lib/pageSections";
import { loadTheme } from "@/lib/theme";
import { cookies, headers } from "next/headers";
import { getAutoManagedPages } from "@/lib/autoManagedPagesData";
import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { isGoogleAuthConfigured } from "@/lib/googleOAuth";
import { SignInGate } from "@/components/auth/SignInGate";
import { ScheduleVoiceAssistant } from "@/components/livekit/ScheduleVoiceAssistant";
import { getOrCreateUserProfile } from "@/lib/userProfiles";
import { isStorefrontEnabled } from "@/lib/store";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navConfig = getNavConfig();
  const theme = loadTheme();
  const showParticles = theme.effects?.particles !== false;
  const particleDensity = theme.effects?.particleDensity ?? "medium";

  const session = await getAdminSession();
  const isAdmin = session.isAdmin === true;
  const editMode = isAdmin && session.editMode === true;
  const publicLegalPage = (await headers()).get("x-sg-public-legal-page") === "1";

  // Require Google sign-in for the public site once OAuth is configured.
  // Admins are always allowed through so they can never lock themselves out.
  const userSession = await getUserSession();
  const signedIn = isSignedIn(userSession) || isAdmin;
  if (isGoogleAuthConfigured() && !signedIn && !publicLegalPage) {
    const cookieStore = await cookies();
    const authError = cookieStore.get("sg-auth-error")?.value;
    return <SignInGate error={authError} />;
  }

  if (publicLegalPage && !signedIn) {
    return (
      <div className="relative min-h-screen bg-[#08050f]">
        <div
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.12),transparent_42%)]"
          aria-hidden="true"
        />
        <main className="relative mx-auto min-h-screen max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
          <Link
            href="/signin"
            className="mb-8 inline-flex min-h-11 items-center text-sm font-semibold text-violet-300 underline-offset-4 hover:text-violet-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            ← Return to sign in
          </Link>
          <div className="overflow-hidden rounded-2xl border border-[#3a3242] bg-[#121019]/95 px-5 py-8 shadow-2xl sm:px-10">
            {children}
          </div>
        </main>
      </div>
    );
  }

  const navUser = isSignedIn(userSession)
    ? {
        name: userSession.name ?? userSession.email ?? "Adventurer",
        email: userSession.email ?? "",
        picture: userSession.picture,
      }
    : null;
  const profileState = isSignedIn(userSession)
    ? getOrCreateUserProfile(userSession)
    : null;
  const liveKitConfigured = Boolean(
    process.env.NODE_ENV !== "production" ||
      (process.env.LIVEKIT_URL &&
        process.env.LIVEKIT_API_KEY &&
        process.env.LIVEKIT_API_SECRET),
  );

  // Paths where the Edit Layout overlay should be available
  const builtInPaths = Object.keys(PAGE_SECTIONS);
  const campaignDetailPaths = getManagedCampaignDetailPaths();
  const customPaths = getActiveCustomPages().map((p) => `/${p.slug}`);
  const managedPaths = [...builtInPaths, ...campaignDetailPaths, ...customPaths];

  return (
    <div className="relative min-h-screen flex flex-col">
      <AnalyticsTracker />
      {/* Fixed ambient particle layer */}
      {showParticles && <ParticleField density={particleDensity} />}

      {/* Navigation */}
      <Navbar
        sections={navConfig.sections}
        isAdmin={isAdmin}
        editMode={editMode}
        user={navUser}
        storeEnabled={isStorefrontEnabled()}
      />
      <ScheduleVoiceAssistant
        configured={liveKitConfigured}
        enabled={profileState?.profile.myraEnabled ?? false}
        isNewVisitor={profileState?.isNew ?? false}
      />

      {/* Page content */}
      <main className="flex-1 relative z-10 pt-16">{children}</main>

      {/* Footer */}
      <Footer />

      {/* Page layout editor — only rendered when admin is logged in */}
      {editMode && (
        <PageEditOverlay
          managedPaths={managedPaths}
          autoManagedPages={getAutoManagedPages()}
        />
      )}
    </div>
  );
}
