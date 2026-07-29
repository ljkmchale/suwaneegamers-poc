import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { getUserProfileContext } from "@/lib/userProfiles";
import { readAssistantPersonas } from "@/lib/assistantPersonaStore";
import { resolvePersona, voiceLabel } from "@/lib/assistantPersonas";
import { saveProfileAction } from "./actions";

export const metadata: Metadata = {
  title: "Your Profile",
  description: "Manage your Suwanee Gamers profile and Myra preferences.",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await getUserSession();
  if (!isSignedIn(session)) redirect("/");
  const { saved } = await searchParams;
  const context = getUserProfileContext(session);
  const personas = readAssistantPersonas();
  // What she would sound like right now, including the automatic pick when the
  // member has never chosen one.
  const resolved = resolvePersona(personas, {
    personaId: context.profile.myraPersona,
    playerName: context.profile.playerName,
    displayName: context.profile.displayName,
  });

  return (
    <div className="relative min-h-screen px-5 pb-20 pt-8">
      <header className="mx-auto mb-8 max-w-4xl">
        <p
          className="mb-2 font-cinzel text-xs uppercase tracking-[0.35em]"
          style={{ color: "var(--color-accent-arcane)" }}
        >
          Adventurer Settings
        </p>
        <h1 className="font-cinzel text-3xl uppercase tracking-widest shimmer-text">
          Your Profile
        </h1>
        <p className="mt-3 max-w-2xl text-sm" style={{ color: "var(--color-text-secondary)" }}>
          This information helps Myra recognize you, know which games you play, and remember
          which parts of the site you use most.
        </p>
      </header>

      <form action={saveProfileAction} className="mx-auto max-w-4xl space-y-6">
        {saved === "1" && (
          <p
            className="rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: "rgba(134,239,172,.35)",
              background: "rgba(20,83,45,.18)",
              color: "#bbf7d0",
            }}
            role="status"
          >
            Your profile has been saved. Myra will use it in your next conversation.
          </p>
        )}

        <section className="fantasy-card p-6">
          <h2 className="font-cinzel text-lg uppercase tracking-wider">Identity</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Signed in as {context.profile.displayName} · {context.profile.email}
          </p>
          <div className="mt-5 rounded-lg border px-4 py-3" style={{ borderColor: "var(--color-bg-border)" }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Suwanee Gamers player
            </p>
            <p className="mt-1 font-medium" style={{ color: "var(--color-text-primary)" }}>
              {context.profile.playerName ?? context.profile.displayName}
            </p>
          </div>
        </section>

        <section className="fantasy-card p-6">
          <h2 className="font-cinzel text-lg uppercase tracking-wider">Your Games</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            These come automatically from the player and campaign rosters.
          </p>
          {context.games.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {context.games.map((game) => (
                <span
                  key={game}
                  className="rounded-full border px-3 py-1 text-xs"
                  style={{ borderColor: "var(--color-bg-border)", color: "var(--color-accent-gold)" }}
                >
                  {game}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              No active campaign assignments are currently listed for your roster identity.
            </p>
          )}
        </section>

        <section className="fantasy-card p-6">
          <h2 className="font-cinzel text-lg uppercase tracking-wider">Favorite Locations</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Learned automatically from the pages you visit most on Suwanee Gamers.
          </p>
          {context.favoriteLocations.length ? (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {context.favoriteLocations.map((location) => (
                <a
                  key={location.path}
                  href={location.path}
                  className="rounded border px-3 py-3 text-sm transition-colors hover:border-violet-400"
                  style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-secondary)" }}
                >
                  <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {location.label}
                  </span>
                  <span className="ml-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {location.visits} visits
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Your favorite site locations will appear as you explore.
            </p>
          )}
        </section>

        <section className="fantasy-card p-6">
          <label className="flex items-start justify-between gap-5">
            <span>
              <span className="block font-cinzel text-lg uppercase tracking-wider">Myra</span>
              <span className="mt-1 block text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Show Myra’s orb and allow voice conversations while you are signed in.
              </span>
            </span>
            <input
              type="checkbox"
              name="myraEnabled"
              defaultChecked={context.profile.myraEnabled}
              className="mt-1 h-5 w-5 accent-violet-400"
              aria-label="Enable Myra"
            />
          </label>

          <div className="mt-6 border-t pt-6" style={{ borderColor: "var(--color-bg-border)" }}>
            <label
              htmlFor="myraPersona"
              className="block text-xs uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              Her voice and manner
            </label>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Only changes how Myra sounds and talks with you — she knows the same things
              either way.
            </p>
            <select
              id="myraPersona"
              name="myraPersona"
              // Remount when the saved value changes: React applies defaultValue
              // only on mount, and resets uncontrolled fields after a form action,
              // which would otherwise show a stale choice after saving.
              key={context.profile.myraPersona ?? "auto"}
              defaultValue={context.profile.myraPersona ?? ""}
              className="mt-4 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
              style={{
                borderColor: "var(--color-bg-border)",
                color: "var(--color-text-primary)",
                background: "rgba(8,5,15,.6)",
              }}
            >
              <option value="">
                Automatic — currently {resolved.persona.label}
              </option>
              {personas.personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.label} — {persona.description}
                </option>
              ))}
            </select>
            <p className="mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
              Now speaking as <strong>{resolved.persona.label}</strong> ({voiceLabel(resolved.persona.voice)})
              {resolved.source === "match"
                ? " — picked for you from the roster."
                : resolved.source === "default"
                  ? " — the house default."
                  : ""}
            </p>
          </div>
        </section>

        <button
          type="submit"
          className="rounded-lg border px-6 py-3 font-cinzel text-sm uppercase tracking-widest transition-colors"
          style={{
            borderColor: "var(--color-accent-gold)",
            color: "var(--color-accent-gold)",
            background: "rgba(90,62,18,.18)",
          }}
        >
          Save Profile
        </button>
      </form>
    </div>
  );
}
