"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const TERMS_ACCEPTANCE_KEY = "sg-terms-of-service-accepted-v1";

function buildLoginHref(provider: "google" | "discord", returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo && returnTo !== "/") params.set("from", returnTo);
  if (typeof document !== "undefined" && document.referrer) params.set("referrer", document.referrer);
  params.set("landing", returnTo || "/signin");
  if (typeof window !== "undefined") {
    for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
      const value = new URLSearchParams(window.location.search).get(key);
      if (value) params.set(key, value);
    }
  }
  return `/api/auth/${provider}/login?${params.toString()}`;
}

/**
 * The terms checkbox is shared across providers on purpose — two independent
 * checkboxes (one per button) would let a visitor accept via one and still
 * see the other disabled, which reads as broken rather than gated.
 */
export function AuthProviderButtons({
  returnTo,
  discordEnabled,
}: {
  returnTo?: string;
  discordEnabled?: boolean;
} = {}) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [googleHref, setGoogleHref] = useState("/api/auth/google/login");
  const [discordHref, setDiscordHref] = useState("/api/auth/discord/login");
  const buttonClasses =
    "inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg px-5 py-3 font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#16121d]";

  useEffect(() => {
    const restoreAcceptance = window.setTimeout(() => {
      setTermsAccepted(window.localStorage.getItem(TERMS_ACCEPTANCE_KEY) === "true");
      setGoogleHref(buildLoginHref("google", returnTo));
      setDiscordHref(buildLoginHref("discord", returnTo));
    }, 0);
    return () => window.clearTimeout(restoreAcceptance);
  }, [returnTo]);

  function updateTermsAcceptance(accepted: boolean) {
    setTermsAccepted(accepted);
    if (accepted) {
      window.localStorage.setItem(TERMS_ACCEPTANCE_KEY, "true");
    } else {
      window.localStorage.removeItem(TERMS_ACCEPTANCE_KEY);
    }
  }

  return (
    <div className="text-left">
      <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-lg border border-[#35303c] bg-black/20 p-4 text-sm leading-6 transition-colors hover:border-[#52475d]">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => updateTermsAcceptance(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#f59e0b]"
        />
        <span className="text-[#b9ab93]">
          I have read and agree to the{" "}
          <Link
            href="/terms-of-use"
            target="_blank"
            className="font-semibold text-violet-300 underline decoration-violet-400/60 underline-offset-4 transition-colors hover:text-violet-200"
          >
            Terms of Use
          </Link>
          .
        </span>
      </label>

      <div className="flex flex-col gap-3">
        {termsAccepted ? (
          <a
            href={googleHref}
            className={`${buttonClasses} bg-[#f7f3ea] text-[#211b25] hover:-translate-y-0.5 hover:bg-white hover:shadow-lg`}
          >
            <GoogleGlyph />
            <span className="text-sm">Sign in with Google</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className={`${buttonClasses} cursor-not-allowed bg-[#f7f3ea] text-[#211b25] opacity-40`}
          >
            <GoogleGlyph />
            <span className="text-sm">Sign in with Google</span>
          </button>
        )}

        {discordEnabled &&
          (termsAccepted ? (
            <a
              href={discordHref}
              className={`${buttonClasses} bg-[#5865F2] text-white hover:-translate-y-0.5 hover:bg-[#4752c4] hover:shadow-lg`}
            >
              <DiscordGlyph />
              <span className="text-sm">Sign in with Discord</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              className={`${buttonClasses} cursor-not-allowed bg-[#5865F2] text-white opacity-40`}
            >
              <DiscordGlyph />
              <span className="text-sm">Sign in with Discord</span>
            </button>
          ))}
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function DiscordGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
