export const dynamic = "force-dynamic";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ParticleField } from "@/components/fantasy/ParticleField";
import { getNavConfig } from "@/lib/nav";
import { getAdminSession } from "@/lib/adminSession";
import { PageEditOverlay } from "@/components/admin/PageEditOverlay";
import { getActiveCustomPages } from "@/lib/customPages";
import { getManagedCampaignDetailPaths } from "@/lib/campaignDetailLayouts";
import { PAGE_SECTIONS } from "@/lib/pageSections";
import { loadTheme } from "@/lib/theme";
import { cookies } from "next/headers";
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

  // Require Google sign-in for the public site once OAuth is configured.
  // Admins are always allowed through so they can never lock themselves out.
  const userSession = await getUserSession();
  const signedIn = isSignedIn(userSession) || isAdmin;
  if (isGoogleAuthConfigured() && !signedIn) {
    const cookieStore = await cookies();
    const authError = cookieStore.get("sg-auth-error")?.value;
    return <SignInGate error={authError} />;
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
