import Image from "next/image";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const ERROR_MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled. Give it another try.",
  state: "Your sign-in session expired. Please try again.",
  exchange: "We couldn't complete sign-in with Google. Please try again.",
  not_configured: "Sign-in is not available right now.",
};

const PORTAL_HIGHLIGHTS = [
  {
    title: "One Living World",
    description: "Many campaigns leave their mark on the shared world of Myrdae.",
    image: "/media/images/signin/one-living-world.webp",
    alt: "Adventurers gathered around a glowing world map where many paths converge",
  },
  {
    title: "Campaign Chronicles",
    description: "Session stories, characters, lore, and history remain connected.",
    image: "/media/images/signin/campaign-chronicles.webp",
    alt: "An illuminated campaign chronicle with memories rising from its pages",
  },
  {
    title: "The Party, In Step",
    description: "Campaign calendars, rosters, recordings, and journeys in one place.",
    image: "/media/images/signin/party-in-step.webp",
    alt: "A party coordinating maps, calendars, messages, and dice around a table",
  },
  {
    title: "Guided by Myra",
    description: "Our voice-enabled guide helps members navigate the world and site.",
    image: "/media/images/signin/guided-by-myra.webp",
    alt: "The arcane guide Myra illuminating paths across a fantasy map",
  },
];

export function SignInGate({ error, returnTo }: { error?: string; returnTo?: string }) {
  const message = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#08050f]">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-45"
        style={{ backgroundImage: 'url("/media/images/battle-scene.webp")' }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,5,15,0.96)_0%,rgba(8,5,15,0.78)_48%,rgba(8,5,15,0.9)_100%),linear-gradient(180deg,rgba(8,5,15,0.38)_0%,rgba(8,5,15,0.96)_100%)]"
        aria-hidden="true"
      />
      <div
        className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-12 lg:py-16">
        <section className="order-2 flex flex-col items-center text-center lg:order-1 lg:items-start lg:text-left">
          <Image
            src="/media/images/suwaneegamers-logo-v18.png"
            alt="Suwanee Gamers"
            width={768}
            height={775}
            sizes="(min-width: 1024px) 288px, (min-width: 640px) 224px, 192px"
            loading="eager"
            fetchPriority="high"
            className="mb-5 h-auto w-48 drop-shadow-[0_0_32px_rgba(245,158,11,0.24)] sm:w-56 lg:w-72"
          />
          <p className="mb-4 font-cinzel text-xs font-semibold uppercase tracking-[0.32em] text-amber-400">
            Established 2012 · Suwanee, Georgia
          </p>
          <h1 className="max-w-2xl font-cinzel text-3xl font-semibold leading-tight text-[#f4ecd8] sm:text-4xl lg:text-5xl">
            Your stories live here.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[#c9bca3] sm:text-lg">
            Enter the private campaign portal for Suwanee Gamers—home to our
            adventurers, campaigns, calendars, chronicles, and the living world of Myrdae.
          </p>

          <div className="mt-7 w-full max-w-2xl">
            <p className="mb-4 font-cinzel text-xs font-semibold uppercase tracking-[0.24em] text-[#d5c7ae]">
              More than a campaign website
            </p>
            <div className="grid gap-3 text-left sm:grid-cols-2">
              {PORTAL_HIGHLIGHTS.map(({ title, description, image, alt }) => (
                <div
                  key={title}
                  className="group relative aspect-[3/2] overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-lg"
                >
                  <Image
                    src={image}
                    alt={alt}
                    fill
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,5,15,0.05)_20%,rgba(8,5,15,0.95)_100%)]"
                    aria-hidden="true"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h2 className="font-cinzel text-sm font-semibold text-[#fff2d4]">{title}</h2>
                    <p className="mt-1 text-xs leading-5 text-[#d0c4ae]">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="divider-rune my-6 w-full max-w-md" aria-hidden="true">
            <span className="font-cinzel text-amber-400">◆</span>
          </div>
          <p className="max-w-lg text-sm leading-7 text-[#a89880]">
            Membership is by invitation only.
          </p>
        </section>

        <section
          aria-labelledby="portal-heading"
          className="relative order-1 mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-[#4a3b2b] bg-[linear-gradient(145deg,rgba(28,24,31,0.97),rgba(14,10,22,0.98))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55),0_0_45px_rgba(139,92,246,0.09)] sm:p-9 lg:order-2"
        >
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent"
            aria-hidden="true"
          />
          <p className="mb-3 font-cinzel text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
            Members&rsquo; Entrance
          </p>
          <h2 id="portal-heading" className="font-cinzel text-2xl font-semibold text-[#f4ecd8]">
            Enter the Portal
          </h2>
          <p className="mb-7 mt-3 text-sm leading-7 text-[#b9ab93]">
            Welcome back, adventurer. Your place at the table is waiting.
          </p>

          {message && (
            <p
              role="alert"
              className="mb-6 rounded-lg border border-red-400/50 bg-red-950/30 px-4 py-3 text-sm text-red-200"
            >
              {message}
            </p>
          )}

          <GoogleSignInButton returnTo={returnTo} />

          <div className="mt-7 border-t border-[#35303c] pt-6 text-center">
            <p className="text-xs leading-6 text-[#8f8298]">
              Anyone may sign in with Google; access to member content remains by
              invitation. We use your Google name and email only to identify you and
              display your active, inactive, or visitor status. We do not sell or share
              your information, and we will not contact you unless you ask us to. Read
              our{" "}
              <Link
                href="/privacy-policy"
                target="_blank"
                className="text-violet-300 underline decoration-violet-400/60 underline-offset-4 transition-colors hover:text-violet-200"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
