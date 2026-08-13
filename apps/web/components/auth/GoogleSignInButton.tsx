"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const TERMS_ACCEPTANCE_KEY = "sg-terms-of-service-accepted-v1";

export function GoogleSignInButton({ returnTo }: { returnTo?: string } = {}) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const href =
    returnTo && returnTo !== "/"
      ? `/api/auth/google/login?from=${encodeURIComponent(returnTo)}`
      : "/api/auth/google/login";
  const buttonClasses =
    "inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg px-5 py-3 font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#16121d]";

  useEffect(() => {
    const restoreAcceptance = window.setTimeout(() => {
      setTermsAccepted(window.localStorage.getItem(TERMS_ACCEPTANCE_KEY) === "true");
    }, 0);
    return () => window.clearTimeout(restoreAcceptance);
  }, []);

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

      {termsAccepted ? (
        <a
          href={href}
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
